import {deploy_anchor} from "./definition";
import {Command} from 'commander';
import {get_lcd_config_with_wallet_for_integration_tests_only, init_terraswap_factory, store_cw20} from "../utils";

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

	let cw20_code_id = await store_cw20(lcd_client, sender);
	console.log(`=======================`);
	let terraswap_factory_addr = await init_terraswap_factory(lcd_client, sender, cw20_code_id);
	console.log(`=======================`);

	await deploy_anchor(lcd_client, sender, cw20_code_id, terraswap_factory_addr);
}

run_program()
    .then(text => {
        console.log(text);
    })
	.catch(err => {
        console.log(err);
    });
