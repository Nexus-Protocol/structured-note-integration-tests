import {Command} from 'commander';
import {get_lcd_config_with_wallet_for_integration_tests_only} from "../../utils";
import {init, single_loan_repayment_withdraw_test} from "./definition";

async function run_program() {
	const program = new Command();
	program
		.action(async () => {
			await run();
		});

	await program.parseAsync(process.argv);
}

async function run() {
	const [lcd_client, sender] = await get_lcd_config_with_wallet_for_integration_tests_only();

	let init_result = await init(lcd_client, sender);
	// await open_position_test_leverage_1(lcd_client, sender, init_result);
	// await open_position_test_leverage_2(lcd_client, sender, init_result);
	// await raw_deposit_test(lcd_client, sender, init_result);
	// await raw_withdraw_test(lcd_client, sender, init_result);
	// await no_loan_repayment_withdraw_test(lcd_client, sender, init_result);
	await single_loan_repayment_withdraw_test(lcd_client, sender, init_result);
}

run_program()
	.then(text => {
		console.log(text);
	})
	.catch(err => {
		console.log(err);
	});
