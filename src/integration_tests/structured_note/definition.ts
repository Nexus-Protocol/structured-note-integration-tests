import {BlockTxBroadcastResult, Coin, getContractEvents, isTxError, LCDClient, Wallet} from "@terra-money/terra.js";
import {
    add_tax,
    create_contract,
    deduct_tax,
    execute_contract,
    get_random_addr,
    init_terraswap_factory,
    query_aterra_rate,
    query_native_token_balance,
    query_token_balance,
    query_ts_pair_addr,
    store_cw20
} from "../../utils";
import {deploy_anchor} from "../../deploy_anchor/definition";
import {deploy_mirror, register_collateral, whitelist_masset, whitelist_proxy} from "../../deploy_mirror/definition";
import {Addr, Decimal, FullInitResult, OracleProxyConfig, PositionResponse, StructuredNoteConfig} from "../../config";
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

export async function open_position_test_leverage_1(lcd_client: LCDClient, sender: Wallet, init_result: FullInitResult) {
    const ONE_HUNDRED_M = 100_000_000;

    const res = await setup(lcd_client, sender, init_result, ONE_HUNDRED_M * 2);
    const masset_token = res[0];
    const pair_addr = res[1];

    const LEVERAGE = 1;
    const AIM_COLLATERAL_RATIO = "2.0";
    const DEPOSIT_AMOUNT = 10_000_000;
    let open_position_result = await execute_contract(lcd_client, sender, init_result.structured_note_addr, {
            deposit: {
                masset_token: masset_token,
                leverage: LEVERAGE,
                aim_collateral_ratio: AIM_COLLATERAL_RATIO,
            }
        },
        [new Coin("uusd", DEPOSIT_AMOUNT)],
    );

    if (open_position_result == undefined) {
        console.log(`open_deposit failed`);
    } else {
        const actual_cycles_amount = await get_leverage_cycles_amount(open_position_result);
        assert(LEVERAGE == actual_cycles_amount);
    }

    const first_anc_deposit = deduct_tax(DEPOSIT_AMOUNT);
    const aterra_rate = await query_aterra_rate(lcd_client, init_result.anchor_info.contract_addr);
    let expected_collateral = first_anc_deposit * aterra_rate;
    // masset_price = 1;
    const expected_loan = Math.floor((expected_collateral / (+AIM_COLLATERAL_RATIO)) * 1);

    const pool_commission = 0.003;
    const pool_masset_balance = ONE_HUNDRED_M;
    const pool_stable_balance = ONE_HUNDRED_M;
    const return_stable = calculate_swap_return(pool_commission, pool_masset_balance, pool_stable_balance, expected_loan);

    expected_collateral += return_stable * aterra_rate;

    const farmers_positions: PositionResponse = await lcd_client.wasm.contractQuery(init_result.structured_note_addr, {
        farmers_positions: {farmer_addr: sender.key.accAddress}
    });
    assert(expected_loan == (+farmers_positions[0].loan));
    assert(expected_collateral == (+farmers_positions[0].collateral));
    console.log(`structured_note: "open_position_test_leverage_1" passed!`);
}

export async function open_position_test_leverage_2(lcd_client: LCDClient, sender: Wallet, init_result: FullInitResult) {
    const ONE_HUNDRED_M = 100_000_000;

    const res = await setup(lcd_client, sender, init_result, ONE_HUNDRED_M * 2);
    const masset_token = res[0];
    const pair_addr = res[1];

    const LEVERAGE = 2;
    const AIM_COLLATERAL_RATIO = "2.0";
    const DEPOSIT_AMOUNT = 10_000_000;
    let open_position_result = await execute_contract(lcd_client, sender, init_result.structured_note_addr, {
            deposit: {
                masset_token: masset_token,
                leverage: LEVERAGE,
                aim_collateral_ratio: AIM_COLLATERAL_RATIO,
            }
        },
        [new Coin("uusd", DEPOSIT_AMOUNT)],
    );

    if (open_position_result == undefined) {
        console.log(`open_deposit failed`);
    } else {
        const actual_cycles_amount = await get_leverage_cycles_amount(open_position_result);
        assert(LEVERAGE == actual_cycles_amount);
    }

    const first_anc_deposit = deduct_tax(DEPOSIT_AMOUNT);
    const aterra_rate = await query_aterra_rate(lcd_client, init_result.anchor_info.contract_addr);
    let expected_collateral = first_anc_deposit * aterra_rate;
    // masset_price = 1;
    const first_loan = Math.floor((expected_collateral / (+AIM_COLLATERAL_RATIO)) * 1);

    const pool_commission = 0.003;
    //first swap
    let pool_masset_balance = ONE_HUNDRED_M;
    let pool_stable_balance = ONE_HUNDRED_M;
    let return_stable = calculate_swap_return(pool_commission, pool_masset_balance, pool_stable_balance, first_loan);

    //second swap
    pool_masset_balance += first_loan;
    pool_stable_balance -= add_tax(return_stable);

    expected_collateral += return_stable * aterra_rate;
    const expected_loan = Math.floor((expected_collateral / (+AIM_COLLATERAL_RATIO)) * 1);

    const loan_diff = expected_loan - first_loan;

    return_stable = calculate_swap_return(pool_commission, pool_masset_balance, pool_stable_balance, loan_diff);

    expected_collateral += return_stable * aterra_rate;

    const farmers_positions: PositionResponse = await lcd_client.wasm.contractQuery(init_result.structured_note_addr, {
        farmers_positions: {farmer_addr: sender.key.accAddress}
    });
    assert(expected_loan == (+farmers_positions[0].loan));
    assert(expected_collateral == (+farmers_positions[0].collateral));
    console.log(`structured_note: "open_position_test_leverage_2" passed!`);
}

export async function raw_deposit_test(lcd_client: LCDClient, sender: Wallet, init_result: FullInitResult) {
    const ONE_HUNDRED_M = 100_000_000;

    const res = await setup(lcd_client, sender, init_result, ONE_HUNDRED_M * 2);
    const masset_token = res[0];

    const LEVERAGE = 1;
    const AIM_COLLATERAL_RATIO = "2.0";
    const DEPOSIT_AMOUNT = 10_000_000;
    await execute_contract(lcd_client, sender, init_result.structured_note_addr, {
            deposit: {
                masset_token: masset_token,
                leverage: LEVERAGE,
                aim_collateral_ratio: AIM_COLLATERAL_RATIO,
            }
        },
        [new Coin("uusd", DEPOSIT_AMOUNT)],
    );

    const RAW_DEPOSIT_AMOUNT = 5_000_000;
    const position_before_raw_deposit: PositionResponse = await lcd_client.wasm.contractQuery(init_result.structured_note_addr, {
        farmers_positions: {farmer_addr: sender.key.accAddress}
    });

    await execute_contract(lcd_client, sender, init_result.structured_note_addr, {
            raw_deposit: {
                masset_token: masset_token,
            }
        },
        [new Coin("uusd", RAW_DEPOSIT_AMOUNT)],
    );
    const position_after_raw_deposit: PositionResponse = await lcd_client.wasm.contractQuery(init_result.structured_note_addr, {
        farmers_positions: {farmer_addr: sender.key.accAddress}
    });

    const aterra_rate = await query_aterra_rate(lcd_client, init_result.anchor_info.contract_addr);
    const expected_collateral_diff = deduct_tax(RAW_DEPOSIT_AMOUNT) * aterra_rate;

    const actual_collateral_diff = (+position_after_raw_deposit[0].collateral) - (+position_before_raw_deposit[0].collateral);

    assert(expected_collateral_diff == actual_collateral_diff);
    assert(+position_before_raw_deposit[0].loan == +position_after_raw_deposit[0].loan);
    console.log(`structured_note: "raw_deposit_test" passed!`);
}

export async function no_loan_repayment_withdraw_test(lcd_client: LCDClient, sender: Wallet, init_result: FullInitResult) {
    const ONE_HUNDRED_M = 100_000_000;

    const res = await setup(lcd_client, sender, init_result, ONE_HUNDRED_M * 2);
    const masset_token = res[0];

    const LEVERAGE = 1;
    const AIM_COLLATERAL_RATIO = "2.0";
    const DEPOSIT_AMOUNT = 10_000_000;

    await execute_contract(lcd_client, sender, init_result.structured_note_addr, {
            deposit: {
                masset_token: masset_token,
                leverage: LEVERAGE,
                aim_collateral_ratio: AIM_COLLATERAL_RATIO,
            }
        },
        [new Coin("uusd", DEPOSIT_AMOUNT)],
    );
    //position state before withdraw
    //loan = 4_995_004
    //collateral = 14_728_370
    //current_collateral_ratio = collateral * collateral_asset_price / loan * loan_asset_price = 14_728_370 * 1 / 4_995_004 * 1 = 2.948620261365156063939
    //minimal_collateral_ratio = 1.65
    //minimal_collateral = minimal_collateral_ratio * loan = 4_995_004 * 1,65 = 8_241_756
    //withdraw_to_min_collateral = collateral - minimal_collateral = 14_728_370 - 8_241_756 = 6_486_614
    const AIM_COLLATERAL_RATIO_WITHDRAW = 2.5;
    //aim collateral amount = loan * loan_asset_price * aim_collateral_ratio = 4_995_004 * 1 * 2,5 = 12_487_510
    const AIM_COLLATERAL = 12_487_510;

    const position_before_withdraw: PositionResponse = await lcd_client.wasm.contractQuery(init_result.structured_note_addr, {
        farmers_positions: {farmer_addr: sender.key.accAddress}
    });

    // need aterra rate before burning aUST
    const aterra_rate = await query_aterra_rate(lcd_client, init_result.anchor_info.contract_addr);

    let result = await execute_contract(lcd_client, sender, init_result.structured_note_addr, {
            withdraw: {
                masset_token: masset_token,
                aim_collateral: AIM_COLLATERAL.toString(),
                aim_collateral_ratio: AIM_COLLATERAL_RATIO_WITHDRAW.toString(),
            }
        },
    );
    let actual_return_stable_amount = 0;
    if (isTxError(result)) {
        return Error("withdraw failed");
    } else {
        let contract_events = getContractEvents(result);
        for (let contract_event of contract_events) {
            let return_amount = contract_event["return_amount"];
            if (return_amount !== undefined) {
                actual_return_stable_amount = +return_amount;
            }
        }
    }

    const position_after_withdraw: PositionResponse = await lcd_client.wasm.contractQuery(init_result.structured_note_addr, {
        farmers_positions: {farmer_addr: sender.key.accAddress}
    });

    const withdraw_amount = (+position_before_withdraw[0].collateral) - AIM_COLLATERAL;
    const expected_return_stable_amount_with_tax = deduct_tax(withdraw_amount * aterra_rate);
    const expected_return_stable_amount = deduct_tax(expected_return_stable_amount_with_tax);

    assert(AIM_COLLATERAL == +position_after_withdraw[0].collateral);
    assert(+position_before_withdraw[0].loan == +position_after_withdraw[0].loan);
    assert(expected_return_stable_amount == actual_return_stable_amount);
    console.log(`structured_note: "no_loan_repayment_withdraw_test" passed!`);
}

export async function single_loan_repayment_withdraw_test(lcd_client: LCDClient, sender: Wallet, init_result: FullInitResult) {
    const ONE_HUNDRED_M = 100_000_000;

    const res = await setup(lcd_client, sender, init_result, ONE_HUNDRED_M * 2);
    const masset_token = res[0];

    const LEVERAGE = 1;
    const AIM_COLLATERAL_RATIO = "2.0";
    const DEPOSIT_AMOUNT = 10_000_000;

    await execute_contract(lcd_client, sender, init_result.structured_note_addr, {
            deposit: {
                masset_token: masset_token,
                leverage: LEVERAGE,
                aim_collateral_ratio: AIM_COLLATERAL_RATIO,
            }
        },
        [new Coin("uusd", DEPOSIT_AMOUNT)],
    );
    //position state before withdraw
    //loan = 4_995_004
    //collateral = 14_728_370
    //current_collateral_ratio = collateral * collateral_asset_price / loan * loan_asset_price = 14_728_370 * 1 / 4_995_004 * 1 = 2.948620261365156063939
    //minimal_collateral_ratio = 1.65
    //minimal_collateral = minimal_collateral_ratio * loan = 4_995_004 * 1,65 = 8_241_756
    //withdraw_to_min_collateral = collateral - minimal_collateral = 14_728_370 - 8_241_756 = 6_486_614
    const AIM_COLLATERAL = 12_487_510;
    // aim_collateral_ratio without c-ratio correction = 2.5
    // to set collateral_ratio > 2.5 c-ratio correction by partial loan repayment is required
    const AIM_COLLATERAL_RATIO_WITHDRAW = 2.6;
    //AIM_LOAN = AIM_COLLATERAL/AIM_COLLATERAL_RATIO = 12_487_510/2.6 = 4802888.461538461538462
    const AIM_LOAN = 4_802_888;

    const position_before_withdraw: PositionResponse = await lcd_client.wasm.contractQuery(init_result.structured_note_addr, {
        farmers_positions: {farmer_addr: sender.key.accAddress}
    });

    //
    // store before withdraw for expected calculation
    //

    const aterra_rate = await query_aterra_rate(lcd_client, init_result.anchor_info.contract_addr);

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

    let pool_masset_balance = await query_token_balance(lcd_client, pair_addr, masset_token);
    let pool_stable_balance = await query_native_token_balance(lcd_client, pair_addr, "uusd");

    let result = await execute_contract(lcd_client, sender, init_result.structured_note_addr, {
            withdraw: {
                masset_token: masset_token,
                aim_collateral: AIM_COLLATERAL.toString(),
                aim_collateral_ratio: AIM_COLLATERAL_RATIO_WITHDRAW.toString(),
            }
        },
    );

    let actual_return_stable_amount = 0;
    if (isTxError(result)) {
        return Error("withdraw failed");
    } else {
        let contract_events = getContractEvents(result);
        for (let contract_event of contract_events) {
            let return_amount = contract_event["return_amount"];
            if (return_amount !== undefined) {
                actual_return_stable_amount = +return_amount;
            }
        }
    }

    const position_after_withdraw: PositionResponse = await lcd_client.wasm.contractQuery(init_result.structured_note_addr, {
        farmers_positions: {farmer_addr: sender.key.accAddress}
    });

    const withdraw_amount = (+position_before_withdraw[0].collateral) - AIM_COLLATERAL;
    const redeem_stable = deduct_tax(withdraw_amount * aterra_rate);

    const MASSET_PRICE = 1;
    const loan_diff_value = (+position_before_withdraw[0].loan - AIM_LOAN) * MASSET_PRICE;

    const POOL_COMMISSION = 0.003;
    const return_masset_amount = calculate_swap_return(POOL_COMMISSION, pool_stable_balance, pool_masset_balance, deduct_tax(loan_diff_value));

    const expected_return_stable_amount = deduct_tax(redeem_stable - loan_diff_value);

    const expected_loan_amount = +position_before_withdraw[0].loan - return_masset_amount;

    assert(AIM_COLLATERAL == +position_after_withdraw[0].collateral);
    //TODO: fix rounding inaccuracy in test
    assert(Math.abs(expected_loan_amount - position_after_withdraw[0].loan) <= 1);
    assert(expected_return_stable_amount == actual_return_stable_amount);
    console.log(`structured_note: "single_loan_repayment_withdraw_test" passed!`);
}

export async function multi_collateral_withdrawing_withdraw_test(lcd_client: LCDClient, sender: Wallet, init_result: FullInitResult) {
    const ONE_HUNDRED_M = 100_000_000;

    const res = await setup(lcd_client, sender, init_result, ONE_HUNDRED_M * 2);
    const masset_token = res[0];

    const LEVERAGE = 1;
    const AIM_COLLATERAL_RATIO = "2.0";
    const DEPOSIT_AMOUNT = 10_000_000;

    await execute_contract(lcd_client, sender, init_result.structured_note_addr, {
            deposit: {
                masset_token: masset_token,
                leverage: LEVERAGE,
                aim_collateral_ratio: AIM_COLLATERAL_RATIO,
            }
        },
        [new Coin("uusd", DEPOSIT_AMOUNT)],
    );
    //position state before withdraw
    //loan = 4_995_004
    //collateral = 14_728_370
    //current_collateral_ratio = collateral * collateral_asset_price / loan * loan_asset_price = 14_728_370 * 1 / 4_995_004 * 1 = 2.948620261365156063939
    //minimal_collateral_ratio = 1.65
    //minimal_collateral = minimal_collateral_ratio * loan = 4_995_004 * 1,65 = 8_241_756
    //withdraw_to_min_collateral = collateral - minimal_collateral = 14_728_370 - 8_241_756 = 6_486_614
    const AIM_COLLATERAL = 7_000_000;
    const AIM_COLLATERAL_RATIO_WITHDRAW = 2.0;
    //AIM_LOAN = AIM_COLLATERAL/AIM_COLLATERAL_RATIO = 7_000_000/2.0 = 3_500_000
    const AIM_LOAN = 3_500_000;

    const position_before_withdraw: PositionResponse = await lcd_client.wasm.contractQuery(init_result.structured_note_addr, {
        farmers_positions: {farmer_addr: sender.key.accAddress}
    });

    //
    // store before withdraw for expected calculation
    //

    const aterra_rate = await query_aterra_rate(lcd_client, init_result.anchor_info.contract_addr);

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

    let pool_masset_balance = await query_token_balance(lcd_client, pair_addr, masset_token);
    let pool_stable_balance = await query_native_token_balance(lcd_client, pair_addr, "uusd");

    let result = await execute_contract(lcd_client, sender, init_result.structured_note_addr, {
            withdraw: {
                masset_token: masset_token,
                aim_collateral: AIM_COLLATERAL.toString(),
                aim_collateral_ratio: AIM_COLLATERAL_RATIO_WITHDRAW.toString(),
            }
        },
    );

    let actual_return_stable_amount = 0;
    if (isTxError(result)) {
        return Error("withdraw failed");
    } else {
        let contract_events = getContractEvents(result);
        for (let contract_event of contract_events) {
            let return_amount = contract_event["return_amount"];
            if (return_amount !== undefined) {
                actual_return_stable_amount = +return_amount;
            }
        }
    }

    const position_after_withdraw: PositionResponse = await lcd_client.wasm.contractQuery(init_result.structured_note_addr, {
        farmers_positions: {farmer_addr: sender.key.accAddress}
    });

    const withdraw_amount = (+position_before_withdraw[0].collateral) - AIM_COLLATERAL;
    const redeem_stable = deduct_tax(withdraw_amount * aterra_rate);

    const MASSET_PRICE = 1;
    const loan_diff_value = (+position_before_withdraw[0].loan - AIM_LOAN) * MASSET_PRICE;

    const POOL_COMMISSION = 0.003;
    const return_masset_amount = calculate_swap_return(POOL_COMMISSION, pool_stable_balance, pool_masset_balance, deduct_tax(loan_diff_value));

    const expected_return_stable_amount = deduct_tax(redeem_stable - loan_diff_value);

    const expected_loan_amount = +position_before_withdraw[0].loan - return_masset_amount;

    assert(AIM_COLLATERAL == +position_after_withdraw[0].collateral);
    //TODO: fix rounding inaccuracy in test
    assert(Math.abs(expected_loan_amount - position_after_withdraw[0].loan) <= 1);
    assert(Math.abs(expected_return_stable_amount - actual_return_stable_amount) <= 1);
    console.log(`structured_note: "multi_collateral_withdrawing_withdraw_test" passed!`);
}

export async function multi_loan_repayment_withdraw_test(lcd_client: LCDClient, sender: Wallet, init_result: FullInitResult) {
    const ONE_HUNDRED_M = 100_000_000;

    const res = await setup(lcd_client, sender, init_result, ONE_HUNDRED_M * 2);
    const masset_token = res[0];

    const LEVERAGE = 3;
    const AIM_COLLATERAL_RATIO = "2.0";
    const DEPOSIT_AMOUNT = 10_000_000;

    await execute_contract(lcd_client, sender, init_result.structured_note_addr, {
            deposit: {
                masset_token: masset_token,
                leverage: LEVERAGE,
                aim_collateral_ratio: AIM_COLLATERAL_RATIO,
            }
        },
        [new Coin("uusd", DEPOSIT_AMOUNT)],
    );

    await lcd_client.wasm.contractQuery(init_result.mirror_info.mint_addr, {
        position: {
            position_idx: "2"
        }
    });

    //position state before withdraw
    //loan = 8_410_991
    //collateral = 17_717_943
    //current_collateral_ratio = collateral * collateral_asset_price / loan * loan_asset_price = 17_717_943 * 1 / 8_410_991 * 1 = 2.10652264400235358711
    const AIM_COLLATERAL = 5_000_000;
    const AIM_COLLATERAL_RATIO_WITHDRAW = 2.0;
    //AIM_LOAN = AIM_COLLATERAL/AIM_COLLATERAL_RATIO = 5_000_000/2.0 = 2_500_000
    const AIM_LOAN = 2_500_000;

    const position_before_withdraw: PositionResponse = await lcd_client.wasm.contractQuery(init_result.structured_note_addr, {
        farmers_positions: {farmer_addr: sender.key.accAddress}
    });

    //
    // store before withdraw for expected calculation
    //

    const aterra_rate = await query_aterra_rate(lcd_client, init_result.anchor_info.contract_addr);

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

    let pool_masset_balance = await query_token_balance(lcd_client, pair_addr, masset_token);
    let pool_stable_balance = await query_native_token_balance(lcd_client, pair_addr, "uusd");

    let result = await execute_contract(lcd_client, sender, init_result.structured_note_addr, {
            withdraw: {
                masset_token: masset_token,
                aim_collateral: AIM_COLLATERAL.toString(),
                aim_collateral_ratio: AIM_COLLATERAL_RATIO_WITHDRAW.toString(),
            }
        },
    );

    let actual_return_stable_amount = 0;
    if (isTxError(result)) {
        return Error("withdraw failed");
    } else {
        let contract_events = getContractEvents(result);
        for (let contract_event of contract_events) {
            let return_amount = contract_event["return_amount"];
            if (return_amount !== undefined) {
                actual_return_stable_amount = +return_amount;
            }
        }
    }

    const position_after_withdraw: PositionResponse = await lcd_client.wasm.contractQuery(init_result.structured_note_addr, {
        farmers_positions: {farmer_addr: sender.key.accAddress}
    });

    //1. withdraw_to_aim_collateral(~12_717_943) > withdraw_to_safe_collateral(~3_839_808) => withdraw_to_safe_collateral(~3_839_808)
    //2. repay_to_aim_loan(~5_910_991) > stable_in_contract(~3_839_808) => repay_all_stable_in_contract(~3_839_808)
    //3. withdraw_to_aim_collateral(~7_717_943) > withdraw_to_safe_collateral(~6_335_683) => withdraw_to_safe_collateral(~6_335_683)
    //4. repay_to_aim_loan(~2_071_183) < stable_in_contract(~6_335_683) => repay_to_aim_loan(~2_071_183); stable_in_contract(~4_264_500)
    //5. withdraw_to_aim_collateral(~2_717_943) < withdraw_to_safe_collateral => withdraw_to_aim_collateral(~2_717_943); stable_in_contract(~6_982_443)

    const SAFE_COLLATERAL_RATIO = 1.65;
    const POOL_COMMISSION = 0.003;
    const MIRROR_PROTOCOL_FEE = 0.015;
    //1.
    let withdraw_to_safe_collateral = +position_before_withdraw[0].collateral - +position_before_withdraw[0].loan * SAFE_COLLATERAL_RATIO;
    let current_collateral = +position_before_withdraw[0].collateral - withdraw_to_safe_collateral;
    let redeem_stable = deduct_tax(withdraw_to_safe_collateral * aterra_rate);
    //2.
    let return_masset_amount = calculate_swap_return(POOL_COMMISSION, pool_stable_balance, pool_masset_balance, deduct_tax(redeem_stable));
    pool_stable_balance += deduct_tax(redeem_stable);
    pool_masset_balance -= return_masset_amount;
    let current_loan = +position_before_withdraw[0].loan - return_masset_amount;
    current_collateral = current_collateral - return_masset_amount * MIRROR_PROTOCOL_FEE;
    //3.
    withdraw_to_safe_collateral = current_collateral - current_loan * SAFE_COLLATERAL_RATIO;
    current_collateral -= withdraw_to_safe_collateral;
    redeem_stable = deduct_tax(withdraw_to_safe_collateral * aterra_rate);
    //4.
    const repay_to_aim_loan = current_loan - AIM_LOAN;
    let return_stable_amount_with_tax = redeem_stable - repay_to_aim_loan;
    return_masset_amount = calculate_swap_return(POOL_COMMISSION, pool_stable_balance, pool_masset_balance, deduct_tax(repay_to_aim_loan));
    current_loan -= return_masset_amount;
    current_collateral = current_collateral - return_masset_amount * MIRROR_PROTOCOL_FEE;
    //5.
    const withdraw_to_aim_collateral = current_collateral - AIM_COLLATERAL;
    redeem_stable = deduct_tax(withdraw_to_aim_collateral * aterra_rate);
    return_stable_amount_with_tax += redeem_stable;
    let expected_return_stable_amount = deduct_tax(return_stable_amount_with_tax);

    assert(AIM_COLLATERAL == +position_after_withdraw[0].collateral);
    assert(current_loan == position_after_withdraw[0].loan);
    //TODO: fix rounding inaccuracy in test
    assert(Math.abs(expected_return_stable_amount - actual_return_stable_amount) <= 10);
    console.log(`structured_note: "multi_loan_repayment_withdraw_test" passed!`);
}

export async function raw_withdraw_test(lcd_client: LCDClient, sender: Wallet, init_result: FullInitResult) {
    const ONE_HUNDRED_M = 100_000_000;

    const res = await setup(lcd_client, sender, init_result, ONE_HUNDRED_M * 2);
    const masset_token = res[0];

    const LEVERAGE = 1;
    const AIM_COLLATERAL_RATIO = "2.0";
    const DEPOSIT_AMOUNT = 10_000_000;

    await execute_contract(lcd_client, sender, init_result.structured_note_addr, {
            deposit: {
                masset_token: masset_token,
                leverage: LEVERAGE,
                aim_collateral_ratio: AIM_COLLATERAL_RATIO,
            }
        },
        [new Coin("uusd", DEPOSIT_AMOUNT)],
    );
    //position state before withdraw
    //loan = 4_995_004
    //collateral = 14_728_370
    //minimal_collateral_ratio = 1.65
    //minimal_collateral = minimal_collateral_ratio * loan = 4_995_004 * 1,65 = 8_241_756
    //max_withdraw_amount = collateral - minimal_collateral = 14_728_370 - 8_241_756 = 6_486_614
    const RAW_WITHDRAW_AMOUNT = 6_000_000;
    const position_before_raw_withdraw: PositionResponse = await lcd_client.wasm.contractQuery(init_result.structured_note_addr, {
        farmers_positions: {farmer_addr: sender.key.accAddress}
    });

    // need aterra rate before burning aUST
    const aterra_rate = await query_aterra_rate(lcd_client, init_result.anchor_info.contract_addr);

    let result = await execute_contract(lcd_client, sender, init_result.structured_note_addr, {
            raw_withdraw: {
                masset_token: masset_token,
                amount: RAW_WITHDRAW_AMOUNT.toString(),
            }
        },
    );
    let actual_return_stable_amount = 0;
    if (isTxError(result)) {
        return Error("raw withdraw failed");
    } else {
        let contract_events = getContractEvents(result);
        for (let contract_event of contract_events) {
            let return_amount = contract_event["return_amount"];
            if (return_amount !== undefined) {
                actual_return_stable_amount = +return_amount;
            }
        }
    }

    const position_after_raw_withdraw: PositionResponse = await lcd_client.wasm.contractQuery(init_result.structured_note_addr, {
        farmers_positions: {farmer_addr: sender.key.accAddress}
    });

    const expected_return_stable_amount_with_tax = deduct_tax(RAW_WITHDRAW_AMOUNT * aterra_rate);
    const expected_return_stable_amount = deduct_tax(expected_return_stable_amount_with_tax);

    const actual_collateral_diff = (+position_before_raw_withdraw[0].collateral) - (+position_after_raw_withdraw[0].collateral);

    assert(RAW_WITHDRAW_AMOUNT == actual_collateral_diff);
    assert(+position_before_raw_withdraw[0].loan == +position_after_raw_withdraw[0].loan);
    assert(expected_return_stable_amount == actual_return_stable_amount);
    console.log(`structured_note: "raw_withdraw_test" passed!`);
}

//----------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------

//1. Whitelist masset
//  1.1. create oracle proxy
//  1.2. whitelist proxy
//  1.3. feed price for symbol
//  1.4. whitelist masset
//2. Register collateral asset
//3. Provide liquidity to mAsset-stable pair
//  3.1. Mint some mAsset
//  3.2. Provide liquidity to the pair
async function setup(
    lcd_client: LCDClient,
    sender: Wallet,
    init_result: FullInitResult,
    stable_amount_for_liquidity: number
) {
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
    const collateral_ratio = 2;
    await mint_masset_with_stable(
        lcd_client,
        sender,
        init_result,
        masset_token,
        stable_amount_for_liquidity,
        collateral_ratio.toString()
    );
    //masset price is 1
    const minted_masset = stable_amount_for_liquidity / collateral_ratio;

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

    await provide_liquidity_asset_stable(
        lcd_client,
        sender,
        pair_addr,
        masset_token,
        (minted_masset),
        add_tax(minted_masset),
    );
    return [masset_token, pair_addr];
}

//-----------------------------------------------------------------------------------------------------------------
// SWAP
// k = pool_mAsset * pool_uusd
// total_exchange_result = pool_uusd - k / (pool_mAsset + offer_mAsset)
// return_stable_without_fee = returnAmount * feeRate = return_stable - (return_stable * pool_commission)
// return_stable_fin = deductTax(return_stable_without_fee)
//=================================================================================================================
/// Subtract tax from return/offer stable
function calculate_swap_return(pool_commission: number, pool_offer_asset_balance: number, pool_ask_asset_balance: number, offer_amount: number) {
    const bn_pool_offer_asset_balance = new BigNumber(pool_offer_asset_balance);
    const bn_pool_ask_asset_balance = new BigNumber(pool_ask_asset_balance);
    const bn_masset_to_sell = new BigNumber(offer_amount);

    const k = bn_pool_offer_asset_balance.times(bn_pool_ask_asset_balance);
    const total_exchange_result = bn_pool_ask_asset_balance.minus(k.div(bn_pool_offer_asset_balance.plus(bn_masset_to_sell)));
    const exchange_result_without_commission = Math.floor(total_exchange_result.minus(total_exchange_result.times(pool_commission)).toNumber());
    return exchange_result_without_commission;
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