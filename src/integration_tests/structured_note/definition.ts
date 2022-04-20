import {BlockTxBroadcastResult, Coin, getContractEvents, isTxError, LCDClient, Wallet} from "@terra-money/terra.js";
import {
    add_tax,
    create_contract,
    deduct_tax,
    execute_contract,
    get_random_addr,
    init_terraswap_factory, query_aterra_rate, query_native_token_balance, query_token_balance,
    query_ts_pair_addr,
    store_cw20
} from "../../utils";
import {deploy_anchor} from "../../deploy_anchor/definition";
import {deploy_mirror, register_collateral, whitelist_masset, whitelist_proxy} from "../../deploy_mirror/definition";
import {
    Addr,
    Decimal,
    FullInitResult,
    OracleProxyConfig,
    PositionResponse,
    StructuredNoteConfig,
    u8
} from "../../config";
import {oracle_proxy_wasm, structured_note_wasm} from "../../artifacts_paths";
import * as assert from "assert";
import BigNumber from "bignumber.js";

//1. Deploy Anchor
//2. Deploy Mirror
//3. Deploy Structured_note
export async function init(
    lcd_client: LCDClient,
    sender: Wallet,
): Promise<FullInitResult> {
    let cw20_code_id = await store_cw20(lcd_client, sender);
    console.log(`=======================`);

    let terraswap_factory_addr = await init_terraswap_factory(lcd_client, sender, cw20_code_id);
    console.log(`=======================`);

    let anchor_info = await deploy_anchor(lcd_client, sender, cw20_code_id, terraswap_factory_addr);

    let mirror_info = await deploy_mirror(
        lcd_client,
        sender,
        cw20_code_id,
        terraswap_factory_addr,
        anchor_info.contract_addr,
        anchor_info.aterra_token_addr,
        anchor_info.bluna_token_addr
    );

    const governance_addr = await get_random_addr();
    const nexus_treasury = await get_random_addr();

    const structured_node_config = StructuredNoteConfig(
        governance_addr,
        mirror_info.mint_addr,
        anchor_info.contract_addr,
        anchor_info.aterra_token_addr,
        nexus_treasury
    );

    const structured_note_addr = await create_contract(
        lcd_client,
        sender,
        "structured_note",
        structured_note_wasm,
        structured_node_config
    );

    return {
        terraswap_factory_addr: terraswap_factory_addr,
        structured_note_addr: structured_note_addr,
        mirror_info: mirror_info,
        anchor_info: anchor_info,
    };
}

// 1. Whitelist masset
//      1.1. create oracle proxy
//      1.2. whitelist proxy
//      1.3. feed price for symbol
//      1.4. whitelist masset
// 2. Register collateral asset
// 3. Provide liquidity to mAsset-stable pair
//      3.1. Mint some mAsset
//      3.2. Provide liquidity to the pair
// 4. Open new position
// 5. Checks
//      5.1. leverage
//      5.2. collateral
//      5.3. loan
export async function open_position_leverage_1(lcd_client: LCDClient, sender: Wallet, init_result: FullInitResult) {
    // 1.1.
    const oracle_proxy_config = OracleProxyConfig(sender.key.accAddress);
    const oracle_proxy_addr = await create_contract(lcd_client, sender, "oracle_proxy", oracle_proxy_wasm, oracle_proxy_config);
    // 1.2.
    await whitelist_proxy(lcd_client, sender, init_result.mirror_info.factory_addr, init_result.mirror_info.tefi_oracle_hub_addr, oracle_proxy_addr, "mirror_oracle");
    // 1.3.
    await execute_contract(lcd_client, sender, oracle_proxy_addr, {
        feed_price: {
            symbol: "OFMA",
            rate: "1",
        }
    });
    // 1.4.
    const masset_token = await whitelist_masset(lcd_client, sender, init_result.mirror_info.factory_addr, "ONE-FIVE", "OFMA", oracle_proxy_addr, "1.5");
    console.log(`masset_token: ${masset_token}`);

    await lcd_client.wasm.contractQuery(init_result.structured_note_addr, {
        config: {}
    });
    // 2.
    await register_collateral(lcd_client, sender, init_result.mirror_info.collateral_oracle_addr, init_result.anchor_info.contract_addr, init_result.anchor_info.aterra_token_addr);

    // 3.1
    await mint_masset_with_stable(
        lcd_client,
        sender,
        init_result,
        masset_token,
        200_000_000,
        "2.0"
    );
    //3.2.
    let pair_addr = await query_ts_pair_addr(
        lcd_client,
        init_result.terraswap_factory_addr,
        [
            {
                token: {
                    contract_addr: masset_token,
                },
            },
            {
                native_token: {
                    denom: "uusd"
                },
            },
        ]);

    const one_hundred_m = 100_000_000;

    await provide_liquidity_asset_stable(
        lcd_client,
        sender,
        pair_addr,
        masset_token,
        one_hundred_m,
        add_tax(one_hundred_m),
    );
    //4.
    const DEPOSIT_AMOUNT = 10_000_000;
    const LEVERAGE: u8 = 1;
    const AIM_COLLATERAL_RATIO: Decimal = "2";

    let open_position_result = await execute_contract(lcd_client, sender, init_result.structured_note_addr, {
            deposit: {
                masset_token: masset_token,
                leverage: LEVERAGE,
                aim_collateral_ratio: AIM_COLLATERAL_RATIO,
            }
        },
        [new Coin("uusd", DEPOSIT_AMOUNT)],
    );
    //5.1
    if (open_position_result == undefined) {
        console.log(`open_deposit failed`);
    } else {
        const actual_cycles_amount = await get_leverage_cycles_amount(open_position_result);
        assert(LEVERAGE == actual_cycles_amount);
    }
    //5.2 - 5.3
    //=================================================================================================================
    // first_anc_deposit = DEPOSIT_AMOUNT - tax
    // query aUST exchange rate: aterra_rate
    // first_collateral (aterra) = first_anc_deposit * aterra_rate
    // loan (mAsset) = (first_collateral_value/AIM_COLLATERAL_RATIO) * mAsset_price
    //-----------------------------------------------------------------------------------------------------------------
    // SWAP
    // k = pool_mAsset * pool_uusd
    // total_exchange_result = pool_uusd - k / (pool_mAsset + offer_mAsset)
    // return_stable_without_fee = returnAmount * feeRate = return_stable - (return_stable * pool_commission)
    // return_stable_fin = deductTax(return_stable_without_fee)
    //=================================================================================================================
    const first_anc_deposit = deduct_tax(DEPOSIT_AMOUNT);
    const aterra_rate = await query_aterra_rate(lcd_client, init_result.anchor_info.contract_addr);
    const first_collateral = first_anc_deposit * aterra_rate;
    // masset_price = 1;
    const expected_loan = Math.floor((first_collateral /  (+ AIM_COLLATERAL_RATIO)) * 1);
    //swap. commission for mirror pools is fixed and equals to 0,3%
    const pool_commission = 0.003;
    const k = new BigNumber(one_hundred_m).times(one_hundred_m);
    const total_exchange_result = new BigNumber(one_hundred_m).minus(new BigNumber(k).div(new BigNumber(one_hundred_m).plus(expected_loan)));
    const exchange_result_without_commission = Math.floor(total_exchange_result.minus(total_exchange_result.times(pool_commission)).toNumber());
    const return_stable = deduct_tax(exchange_result_without_commission);
    const second_collateral = return_stable * aterra_rate;
    const expected_collateral = first_collateral + second_collateral;

    let farmers_positions: PositionResponse = await lcd_client.wasm.contractQuery(init_result.structured_note_addr, {
        farmers_positions: {farmer_addr: sender.key.accAddress}
    });
    console.log(`-----> collateral - expected: ${expected_collateral}, actual - ${farmers_positions.collateral}`);
    console.log(`-----> loan - expected: ${expected_loan}, actual - ${farmers_positions.loan}`);

    assert(expected_loan ==  (+ farmers_positions.loan));
    assert(expected_collateral ==  (+ farmers_positions.collateral));
    console.log(`structured_note test: "open_position_leverage_1 passed!"`)
}

async function mint_masset_with_stable(lcd_client: LCDClient, sender: Wallet, init_result: FullInitResult, masset_token: Addr, amount: number, collateral_ratio: Decimal) {
    await execute_contract(
        lcd_client,
        sender,
        init_result.mirror_info.mint_addr,
        {
            open_position: {
                collateral: {
                    info: {
                        native_token: {
                            denom: "uusd",
                        }
                    },
                    amount: amount.toString()
                },
                asset_info: {
                    token: {
                        contract_addr: masset_token,
                    },
                },
                collateral_ratio: collateral_ratio,
            }
        },
        [new Coin("uusd", amount)],
    );
}

async function provide_liquidity_asset_stable(
    lcd_client: LCDClient,
    sender: Wallet,
    pair_addr: Addr,
    masset_token: Addr,
    masset_amount: number,
    stable_amount: number) {
    // increase allowance
    await execute_contract(
        lcd_client,
        sender,
        masset_token,
        {
            increase_allowance: {
                spender: pair_addr,
                amount: masset_amount.toString(),
            }
        });
    // provide_liquidity
    await execute_contract(
        lcd_client,
        sender,
        pair_addr,
        {
            provide_liquidity: {
                assets: [
                    {
                        info: {
                            token: {
                                contract_addr: masset_token,
                            }
                        },
                        amount: masset_amount.toString()
                    },
                    {
                        info: {
                            native_token: {
                                denom: "uusd"
                            }
                        },
                        amount: stable_amount.toString()
                    }
                ],
            }
        },
        [new Coin("uusd", stable_amount)],
    );
}

async function get_leverage_cycles_amount(result: BlockTxBroadcastResult) {
    if (isTxError(result)) {
        throw new Error(
            `${result.code} - ${result.raw_log}`
        );
    }

    let contract_events = getContractEvents(result);

    let cycles_amount = 0;

    for (let contract_event of contract_events) {
        let action = contract_event["action"];
        if (action == "deposit_stable_to_anchor_market") {
            cycles_amount += 1;
        }
    }
    // Subtract initial deposit to anchor (- 1)
    if (cycles_amount < 2) {
        return 0
    }
    return cycles_amount - 1;
}