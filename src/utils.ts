import {readFileSync} from 'fs';
import {
    BlockTxBroadcastResult,
    Coin,
    Coins,
    getCodeId,
    getContractAddress,
    getContractEvents,
    LCDClient,
    LocalTerra,
    MnemonicKey,
    Msg,
    MsgExecuteContract,
    MsgInstantiateContract,
    MsgStoreCode,
    StdFee,
    Wallet
} from '@terra-money/terra.js';
import {SecretsManager} from 'aws-sdk';
import * as prompt from 'prompt';
import {isTxSuccess} from './transaction';
import {Addr, EpochStateResponse, PairInfoResponse, TokenConfig, u64} from "./config";
import {cw20_contract_wasm, terraswap_factory_wasm, terraswap_pair_wasm, terraswap_token_wasm} from "./artifacts_paths";
import BN from "bignumber.js";
import {response} from "express";

export async function create_contract(lcd_client: LCDClient, sender: Wallet, contract_name: string, wasm_path: string, init_msg: object, init_funds?: Coin[]): Promise<Addr> {
    let code_id = await store_contract(lcd_client, sender, wasm_path);
    console.log(`${contract_name} uploaded\n\tcode_id: ${code_id}`);
    let contract_addr = await instantiate_contract(lcd_client, sender, sender.key.accAddress, code_id, init_msg, init_funds);
    console.log(`${contract_name} instantiated\n\taddress: ${contract_addr}`);
    return contract_addr;
}

// ============================================================

export async function store_contract(lcd_client: LCDClient, sender: Wallet, wasm_path: string): Promise<number> {
    let contract_wasm = readFileSync(wasm_path, {encoding: 'base64'});
    const messages: Msg[] = [new MsgStoreCode(sender.key.accAddress, contract_wasm)];

    while (true) {
        let result = await calc_fee_and_send_tx(lcd_client, sender, messages);
        if (result !== undefined && isTxSuccess(result)) {
            return parseInt(getCodeId(result));
        } else {
            await sleep(1000);
        }
    }
}

export async function instantiate_contract_raw(lcd_client: LCDClient, sender: Wallet, admin: string, code_id: u64, init_msg: object, init_funds?: Coin[]): Promise<BlockTxBroadcastResult> {
    const messages: Msg[] = [new MsgInstantiateContract(
        sender.key.accAddress,
        admin,
        code_id,
        init_msg,
        init_funds
    )];

    while (true) {
        let result = await calc_fee_and_send_tx(lcd_client, sender, messages);
        if (result !== undefined && isTxSuccess(result)) {
            return result;
        } else {
            throw Error("instantiate contract failed!");
        }
    }
}

export async function instantiate_contract(lcd_client: LCDClient, sender: Wallet, admin: string, code_id: u64, init_msg: object, init_funds?: Coin[]): Promise<string> {
    let result = await instantiate_contract_raw(lcd_client, sender, admin, code_id, init_msg, init_funds);
    return getContractAddress(result)
}

export async function execute_contract(lcd_client: LCDClient, sender: Wallet, contract_addr: Addr, execute_msg: object, coins?: Coin[]): Promise<BlockTxBroadcastResult | undefined> {
    const messages: Msg[] = [new MsgExecuteContract(
        sender.key.accAddress,
        contract_addr,
        execute_msg,
        coins
    )];
    let result = await send_message(lcd_client, sender, messages);
    return result
}

export async function send_message(lcd_client: LCDClient, sender: Wallet, messages: Msg[], tax?: Coin[]) {
    let result = await calc_fee_and_send_tx(lcd_client, sender, messages, tax);
    return result
}

// ============================================================

export interface TerraswapPairInfo {
    pair_contract_addr: Addr,
    liquidity_token_addr: Addr
}

export async function create_usd_to_token_terraswap_pair(lcd_client: LCDClient, sender: Wallet, terraswap_factory_addr: Addr, token_addr: Addr): Promise<TerraswapPairInfo> {
    const create_pair_msg = {
        create_pair: {
            asset_infos: [
                {token: {contract_addr: token_addr}},
                {native_token: {denom: "uusd"}},
            ]
        }
    };

    while (true) {
        let pair_creation_result = await execute_contract(lcd_client, sender, terraswap_factory_addr, create_pair_msg);
        if (pair_creation_result !== undefined && isTxSuccess(pair_creation_result)) {
            return parse_pair_creation(pair_creation_result);
        } else {
            await sleep(1000);
        }
    }
}

export async function create_token_to_token_terraswap_pair(lcd_client: LCDClient, sender: Wallet, terraswap_factory_contract_addr: Addr, token_1_addr: Addr, token_2_addr: Addr): Promise<TerraswapPairInfo> {
    const create_pair_msg = {
        create_pair: {
            asset_infos: [
                {token: {contract_addr: token_1_addr}},
                {token: {contract_addr: token_2_addr}},
            ]
        }
    };

    while (true) {
        let pair_creation_result = await execute_contract(lcd_client, sender, terraswap_factory_contract_addr, create_pair_msg);
        if (pair_creation_result !== undefined && isTxSuccess(pair_creation_result)) {
            return parse_pair_creation(pair_creation_result);
        } else {
            await sleep(1000);
        }
    }
}

function parse_pair_creation(pair_creation_result: BlockTxBroadcastResult): TerraswapPairInfo {
    var pair_info: TerraswapPairInfo = {
        pair_contract_addr: '',
        liquidity_token_addr: ''
    };
    let contract_events = getContractEvents(pair_creation_result);
    for (let contract_event of contract_events) {
        let pair_contract_addr = contract_event["pair_contract_addr"];
        if (pair_contract_addr !== undefined) {
            pair_info.pair_contract_addr = pair_contract_addr;
        }

        let liquidity_token_addr = contract_event["liquidity_token_addr"];
        if (liquidity_token_addr !== undefined) {
            pair_info.liquidity_token_addr = liquidity_token_addr;
        }
    }

    return pair_info;
}

// ============================================================

export async function calc_fee_and_send_tx(lcd_client: LCDClient, sender: Wallet, messages: Msg[], _tax?: Coin[]): Promise<BlockTxBroadcastResult | undefined> {
    try {
        // const estimated_tx_fee = await get_tx_fee(lcd_client, sender, messages, tax);
        // if (estimated_tx_fee === undefined) {
        // 	return undefined;
        // }
        const estimated_tx_fee = new StdFee(300_000_000 / 0.15, [new Coin("uusd", 300_303_000)]);

        const signed_tx = await sender.createAndSignTx({
            msgs: messages,
            fee: estimated_tx_fee,
        });

        const tx_result = await lcd_client.tx.broadcast(signed_tx);
        return tx_result;
    } catch (err) {
        console.error(`calc_fee_and_send_tx return err: ${err}`)
        return undefined;
    }
}

async function get_tx_fee(lcd_client: LCDClient, sender: Wallet, msgs: Msg[], tax?: Coin[]): Promise<StdFee | undefined> {
    try {
        const estimated_fee_res = await lcd_client.tx.estimateFee(sender.key.accAddress, msgs, {
            gasPrices: new Coins([new Coin("uusd", 0.15)]),
            gasAdjustment: 1.2,
            feeDenoms: ["uusd"],
        });

        if (tax !== undefined) {
            let fee_coins: Coins = estimated_fee_res.amount;
            for (const tax_coin of tax) {
                fee_coins.add(tax_coin);
            }
            const fee_with_tax = new StdFee(estimated_fee_res.gas, fee_coins);
            return fee_with_tax;
        }

        return estimated_fee_res;
    } catch (err) {
        console.error(`get_tax_rate return err: ${err}`)
        return undefined;
    }
}

// ===========================================================

export function sleep(ms: number) {
    return new Promise(
        resolve => setTimeout(resolve, ms, [])
    );
}

export function get_date_str(): string {
    return new Date().toISOString().replace('T', ' ');
}

export function to_utc_seconds(date_str: string): number {
    const date = new Date(date_str)
    const time_zone_offset_in_ms = date.getTimezoneOffset() * 60 * 1_000
    return (date.getTime() - time_zone_offset_in_ms) / 1_000
}

const seed_prompt = [
    {
        name: 'seed',
        hidden: true
    }
];

export function prompt_for_seed(): Promise<string> {
    return new Promise(resolve => {
        prompt.get(seed_prompt, (err, result) => {
            if (err) {
                process.exit(1);
            }
            resolve(result.seed.toString())
        });
    });
}

export async function get_seed_from_aws_secrets(region: string, secret_name: string): Promise<string | undefined> {
    var client = new SecretsManager({
        region: region
    });

    return client.getSecretValue({SecretId: secret_name}).promise().then((data) => {
        if (data.SecretString !== undefined) {
            return JSON.parse(data.SecretString).seed;
        } else {
            return undefined;
        }
    });
}

export interface AwsSecrets {
    region: string,
    secret_name: string
}

export interface LCDConfig {
    localterra: boolean,
    url?: string,
    chain_id?: string,
    aws_secrets?: AwsSecrets
}

function check_non_localterra(lcd_config: LCDConfig) {
    if (!lcd_config.localterra) {
        if (lcd_config.url === undefined || lcd_config.chain_id === undefined) {
            console.error(`wrong LCDConfig: 'url' or/and 'chain_id' is not set`);
            process.exit(1);
        }
    }
}

export async function get_lcd_config_with_wallet(lcd_config: LCDConfig): Promise<[LCDClient, Wallet]> {
    let lcd_client: LCDClient;
    let sender: Wallet;
    if (lcd_config.localterra) {
        const localterra = new LocalTerra()
        lcd_client = localterra;
        sender = localterra.wallets["test1"];
    } else if (lcd_config.aws_secrets !== undefined) {
        check_non_localterra(lcd_config);
        lcd_client = new LCDClient({
            URL: lcd_config.url!,
            chainID: lcd_config.chain_id!
        });

        const seed = await get_seed_from_aws_secrets(lcd_config.aws_secrets.region, lcd_config.aws_secrets.secret_name);

        if (seed === undefined) {
            console.error(`can't find seed on AWS; region: ${lcd_config.aws_secrets.region}, secret_name: ${lcd_config.aws_secrets.secret_name}`);
            process.exit(1);
        }

        const owner = new MnemonicKey({mnemonic: seed});
        sender = new Wallet(lcd_client, owner);
    } else {
        check_non_localterra(lcd_config);
        lcd_client = new LCDClient({
            URL: lcd_config.url!,
            chainID: lcd_config.chain_id!
        });
        const seed = await prompt_for_seed();
        const owner = new MnemonicKey({mnemonic: seed});
        sender = new Wallet(lcd_client, owner);
    }

    return [lcd_client, sender];
}

export async function get_lcd_config(lcd_config: LCDConfig): Promise<LCDClient> {
    let lcd_client: LCDClient;
    if (lcd_config.localterra) {
        const localterra = new LocalTerra()
        lcd_client = localterra;
    } else {
        check_non_localterra(lcd_config);
        lcd_client = new LCDClient({
            URL: lcd_config.url!,
            chainID: lcd_config.chain_id!
        });
    }

    return lcd_client;
}

//=====================================

export async function get_lcd_config_with_wallet_for_integration_tests_only(): Promise<[LCDClient, Wallet]> {
    const localterra = new LocalTerra()
    const lcd_client: LCDClient = localterra;
    const sender: Wallet = localterra.wallets["test1"];

    return [lcd_client, sender];
}

export async function get_random_addr() {
    const source = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const seed = get_random_seed(source, 64);
    const owner = new MnemonicKey({account: 1, index: 1, mnemonic: seed});
    return owner.accAddress;
}

function get_random_seed(source: string, seed_length: number) {
    let result = '';
    for (let i = 0; i < seed_length; i++) {
        result = result.concat(source.charAt(Math.random() * source.length));
    }
    return result;
}

// ================================================

export async function store_cw20(lcd_client: LCDClient, sender: Wallet): Promise<number> {
    console.log(`storing our own cw20`);
    let cw20_code_id = await store_contract(lcd_client, sender, cw20_contract_wasm);
    console.log(`cw20_base uploaded; code_id: ${cw20_code_id}`);
    return cw20_code_id;
}

export async function init_terraswap_factory(lcd_client: LCDClient, sender: Wallet, cw20_code_id: number): Promise<string> {
    console.log(`in localterra, so storing our own terraswap contracts`);
    let terraswap_factory_code_id = await store_contract(lcd_client, sender, terraswap_factory_wasm);
    console.log(`terraswap_factory uploaded\n\tcode_id: ${terraswap_factory_code_id}`);
    let terraswap_pair_code_id = await store_contract(lcd_client, sender, terraswap_pair_wasm);
    console.log(`terraswap_pair uploaded\n\tcode_id: ${terraswap_pair_code_id}`);
    let terraswap_factory_init_msg = {
        pair_code_id: terraswap_pair_code_id,
        token_code_id: cw20_code_id,
    };
    let terraswap_factory_contract_addr = await instantiate_contract(lcd_client, sender, sender.key.accAddress, terraswap_factory_code_id, terraswap_factory_init_msg);
    console.log(`terraswap_factory instantiated\n\taddress: ${terraswap_factory_contract_addr}`);
    return terraswap_factory_contract_addr;
}

export async function store_terraswap_token(lcd_client: LCDClient, sender: Wallet): Promise<number> {
    console.log(`storing terraswap token`);
    let terra_swap_token_code_id = await store_contract(lcd_client, sender, terraswap_token_wasm);
    console.log(`terraswap_token uploaded; code_id: ${terra_swap_token_code_id}`);
    return terra_swap_token_code_id;
}

export async function init_token(lcd_client: LCDClient, sender: Wallet, code_id: number, init_msg: TokenConfig): Promise<string> {
    let contract_addr = await instantiate_contract(lcd_client, sender, sender.key.accAddress, code_id, init_msg);
    console.log(`${init_msg.name} instantiated\n\taddress: ${contract_addr}`);
    return contract_addr;
}

export async function query_config(lcd_client: LCDClient, anchor_addr: Addr) {
    let config = await lcd_client.wasm.contractQuery(anchor_addr, {
        config: {}
    });
    console.log(JSON.stringify(config));
}

export async function query_ts_pair_addr(lcd_client: LCDClient, terraswap_factory_addr: Addr, asset_infos: Object) {
    let res: PairInfoResponse = await lcd_client.wasm.contractQuery(terraswap_factory_addr,
        {
            pair: {
                asset_infos: asset_infos,
            },
        });

    return res.contract_addr;
}

/**
 * @notice Given a total amount of UST, find the deviverable amount, after tax, if we
 * transfer this amount.
 * @param amount The total amount
 * @dev Assumes a tax rate of 0.001 and cap of 1000000 uusd.
 * @dev Assumes transferring UST. Transferring LUNA does not incur tax.
 */
export function deduct_tax(amount: number) {
    const DECIMAL_FRACTION = new BN("1000000000000000000");
    const tax = Math.min(
        amount -
        new BN(amount)
            .times(DECIMAL_FRACTION)
            .div(DECIMAL_FRACTION.div(new BN(1000)).plus(DECIMAL_FRACTION))
            .toNumber(),
        1000000
    );
    return Math.floor(amount - tax);
}

/**
 * @notice Given a intended deliverable amount, find the total amount, including tax,
 * necessary for deliver this amount. Opposite operation of `deductTax`.
 * @param amount The intended deliverable amount
 * @dev Assumes a tax rate of 0.001 and cap of 1000000 uusd.
 * @dev Assumes transferring UST. Transferring LUNA does not incur tax.
 */
export function add_tax(amount: number) {
    const tax = Math.min(new BN(amount).div(new BN(1000)).toNumber(), 1000000);
    return amount + tax;
}

export async function query_native_token_balance(
    lcd_client: LCDClient,
    account: Addr,
    denom: string
) {
    const balance = (await lcd_client.bank.balance(account)).get(denom)?.amount.toString();
    if (balance) {
        return  + balance;
    } else {
        return 0;
    }
}

export async function query_token_balance(
    lcd_client: LCDClient,
    token_addr: Addr,
    account: Addr,
) {
    const res = await lcd_client.wasm.contractQuery<{ balance: string }>(token_addr, {
        balance: { address: account },
    })

    return + res.balance;
}

export async function query_aterra_rate(lcd_client: LCDClient, anchor_market_addr: Addr) {
    let res:  EpochStateResponse = await lcd_client.wasm.contractQuery(anchor_market_addr,
        {epoch_state: {}});

    return + res.exchange_rate;
}