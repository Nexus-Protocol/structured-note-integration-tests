import {Command} from 'commander';
import {get_lcd_config_with_wallet_for_integration_tests_only} from "../../utils";
import {open_position, run_integration_tests} from "./definition";

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

	let init_result = await run_integration_tests(lcd_client, sender);
	await open_position(lcd_client, sender, init_result);
}

run_program()
	.then(text => {
		console.log(text);
	})
	.catch(err => {
		console.log(err);
	});
