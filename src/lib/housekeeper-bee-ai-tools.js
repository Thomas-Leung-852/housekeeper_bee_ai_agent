const { default: TelegramBot } = await import('node-telegram-bot-api');
import { ZigbeeDeviceManager, ZigbeeDeviceAnalyst } from './zigbee-devices.js';
import fetch  from 'node-fetch';


class HousekeeperBeeAiTools
{
		constructor(host = 'http://localhost:11434', model = 'llama3.2', botToken, chatIds, housekeeperBeeConfig = {}) {
			this.host = host;
			this.model = model;;
			this.botToken = botToken;
			this.chatIds = chatIds;
			this.processingFlag = false;

			this.bot = new TelegramBot(botToken, { polling: true});
			this.handleMessage = this.handleMessage.bind(this);
			this.bot.on('message', this.handleMessage);

			this.callerChartId = 9999999;
			this.zigbeeDeviceAnalyst = new ZigbeeDeviceAnalyst('mqtt://localhost:1883');

			this.beeUrl = housekeeperBeeConfig.url
			this.beeApiKey = housekeeperBeeConfig.apiKey
			this.beeEnabled = (housekeeperBeeConfig.enabled.toLowerCase() === 'true' || housekeeperBeeConfig.enabled.toLowerCase() === 'yes' || housekeeperBeeConfig.enabled.toLowerCase() === 'enable'? true : false);
			this.beeAdminUrl = housekeeperBeeConfig.admin_url

		}

		/***********************************************
		// Functions
		***********************************************/

		// Check string is a TW Chinese
		containsChinese(str){
		  const regex = /\p{Script=Han}/u;
		  return regex.test(str);
		};


		// Math rounding
		roundUpToOneDecimalPlace(num) {
			return Math.ceil(num * 10) / 10;
		}

		// Get all zigbee device profiles
		async getAllZigbeeDevice(){

			const zigbeeManager = new ZigbeeDeviceManager();
			var devices = null
			var onlineDevices = null;

			try {
				await zigbeeManager.connect();
				console.log('Waiting for device discovery...');
				await new Promise(resolve => setTimeout(resolve, 3000));
				devices = await zigbeeManager.requestDevicesList();

				// Get online devices
				onlineDevices = zigbeeManager.getOnlineDevices();
			} catch (error) {
				console.log('Error: ', error);
			}finally {
				// Clean up
				setTimeout(() => {
				zigbeeManager.disconnect();
				}, 1000);
			}

			return { devices, onlineDevices };
		}


 		// Get all zigbee temperature and humidity device state
                async getAllZigbeeRHnTempDevice(){

                        const zigbeeManager = new ZigbeeDeviceManager();
                        var devices = null

                        try {
                                await zigbeeManager.connect();
                                await new Promise(resolve => setTimeout(resolve, 3000));
                                devices = await zigbeeManager.getDevicesByType('Temperature and Humidity');
                        } catch (error) {
                                console.log('Error: ', error);
                        }finally {
                                // Clean up
                                setTimeout(() => {
                                zigbeeManager.disconnect();
                                }, 1000);
                        }

                        return devices;
                }


		/************************************************************** 
		* AI Tools
		***************************************************************/
		async getAllTemperatureAndHumiditySensor(){

			const devices = await this.getAllZigbeeRHnTempDevice();

			var rsp = ['Temperature and Humidity devices state'];

			if(devices){
				var temperatureUnit = '';

				devices.forEach((device, index) => {
					const exposes = device.definition.exposes.filter(ex => ex.description.includes('temperature value'));

					if(exposes){
						temperatureUnit = exposes[0].unit;
					}
					rsp.push(`${index+1}. ${device.friendly_name}`);
					rsp.push(`Temperature: ${device.lastData.temperature}${temperatureUnit}`);
					rsp.push(`Humidity: ${device.lastData.humidity}%`);
					rsp.push(`Battery: ${device.lastData.battery}%`);
					rsp.push('');
				});
			}else{
				rsp.push('No devices found!');
			}
			return rsp.join('\n');
		}


		// Power on a device
		async switchOnPlug(deviceName){
			try{
				const {devices} = await this.getAllZigbeeDevice();

				if(devices){
					const device = devices.filter( dev => dev.friendly_name === deviceName );

					if(device){
						const states = await this.zigbeeDeviceAnalyst.getDeviceState(deviceName); 

						if( `${states.mode || 'unknown'}` === 'switch' ){
							if(states.state === 'OFF'){
								const okayFlag = await this.zigbeeDeviceAnalyst.publishMsgToDevice(device[0].ieee_address, `{ "state": "ON" }`);

								return  (okayFlag ? 'Switched On' : 'Failed');
							}else{
								return 'Already On';
							}
						}else{
								return 'Unsupported Device Type.';
						}
					}
				}
				return 'Device not found!'
			}catch(error){
				console.log(error);
				return 'Device not found!'
			}
		}

		// Power off a device
		async switchOffPlug(deviceName){
			try{
				const {devices} = await this.getAllZigbeeDevice();

				if(devices){
					const device = devices.filter( dev => dev.friendly_name === deviceName );

					if(device){
						const states = await this.zigbeeDeviceAnalyst.getDeviceState(deviceName); 

						if( `${states.mode || 'unknown'}` === 'switch' ){
							if(states.state === 'ON'){
								const okayFlag = await this.zigbeeDeviceAnalyst.publishMsgToDevice(device[0].ieee_address, `{ "state": "OFF" }`);

								return  (okayFlag ? 'Switched Off' : 'Failed');
							}else{
								return 'Already Off';
							}
						}else{
								return 'Unsupported Device Type.';
						}
					}
				}
				return 'Device not found!'
			}catch(error){
				console.log(error);
				return 'Device not found!'
			}

		}

		// clickButton
		async clickButton(deviceName){
			try{
				const {devices} = await this.getAllZigbeeDevice();

				if(devices){
					const device = devices.filter( dev => dev.friendly_name === deviceName );

					if(device){
						const states = await this.zigbeeDeviceAnalyst.getDeviceState(deviceName); 

						if(`${states.mode || 'unknown'}` === 'click'){
							const cmd = (states.state === 'ON' ? 'OFF' : 'ON');
							const okayFlag = await this.zigbeeDeviceAnalyst.publishMsgToDevice(device[0].ieee_address, `{ "state": "${cmd}" }`);

							return  (okayFlag ? 'Pressed' : 'Failed');
						}else{
							return 'Unsupported Device Type.';
						}
					}
				}
				return 'Device not found!'
			}catch(error){
				console.log(error);
				return 'Device not found!'
			}
		}

		// show AI tools help
		showHelp(){
			var cnt = 1;
			var desc = ['==== Function List ===='];

			this.tools.forEach((tool, index) => {
				if(tool.display){
					desc.push(`${cnt}. ${tool.title}`);
					desc.push(tool.detail);
					desc.push('');
					cnt = cnt + 1;
				}
			});

			desc.push('To use Housekeeper Bee server tools, please set HOUSEKEEPER\\_BEE\\_ENABLED to true from .env.prod file.');

			return desc.join('\n');
		}

		// Get Zigbee device state
		async getDeviceState(deviceName){
			var temperatureUnit = '°C';
			var results = [];

			try {
				const deviceState = await this.zigbeeDeviceAnalyst.getDeviceState(deviceName);

				results.push(deviceName);

				if(deviceState){
					if(deviceState.temperature){
						if(deviceState.temperature_units){ 
							temperatureUnit = (deviceState.temperature_units === 'celsius' ? '°C' : '°F') 
						}
						results.push(`Temperature: ${deviceState.temperature} ${temperatureUnit}`); 
					}

					if(deviceState.humidity){ results.push(`Humidity: ${deviceState.humidity}%`); }
					if(deviceState.battery){ results.push(`Battery: ${deviceState.battery}%`); }
					if(deviceState.state){ results.push(`State: ${deviceState.state}`); }
					if(deviceState.reverse){ results.push(`Reverse: ${deviceState.reverse}`); }
					if(deviceState.touch){ results.push(`Touch: ${deviceState.touch}`); }
					if(deviceState.mode){ results.push(`Touch: ${deviceState.mode}`); }
				}
			} catch (error) {
				results.push('Error getting device state:', error.message);
			}

			return results.join('\n');
		}


		// Get all zigbee device list
		async showZigBeeDevicesList(){
			const {devices, onlineDevices} = await this.getAllZigbeeDevice();

			var results = ['\n=== All Zigbee Devices ==='];

			if(devices != null && onlineDevices != null){
				devices.forEach((device, index) => {
					results.push(`${index + 1}. ${device.friendly_name}`);
					results.push(`Status: ${device.status}`);
					results.push(`Battery: ${device.lastData.battery}%`);
					results.push(`Mode: ${device.lastData.mode || '-:-'}`);
					results.push(`Vendor: ${device.definition?.vendor || 'Unknown'}`);
					results.push(`${device.definition.description}`)
					results.push('');
				});

				results.push(`\n=== Summary ===`);
				results.push(`Total: ${devices.length}`);
				results.push(`Online: ${onlineDevices.length}`);
			}

			return results.join('\n');
		}

		// Get Zigbee device profile by friendly name/ device name
		async showZigBeeDeviceByName(deviceName){

			var {devices, onlineDevices} = await this.getAllZigbeeDevice();
			var results = [`\n=== ${args.friendly_name} Details ===`];

			if(devices != null && onlineDevices != null){

				devices = devices.filter(device => device.friendly_name === deviceName);
				onlineDevices = onlineDevices.filter(device => device.friendly_name === deviceName);

				devices.forEach((device, index) => {
					results.push(`${index + 1}. ${device.friendly_name}`);
					results.push(`   IEEE Address: ${device.ieee_address}`);
					results.push(`   Battery: ${device.lastData.battery}%`);
					results.push(`   Type: ${device.type}`);
					results.push(`   Model: ${device.model_id || 'Unknown'}`);
					results.push(`   Vendor: ${device.definition?.vendor || 'Unknown'}`);
					results.push(`   Status: ${device.status}`);
					results.push(`   Last Seen: ${device.lastSeen || 'Never'}`);
					results.push('');
				});
			}

			return results.join('\n');
		}

		// Message handler
		async handleMessage(msg){
			const matchedChatId = this.chatIds.filter(chatId => chatId == msg.chat.id); 

			if(matchedChatId.length != 1){
				this.sendTelegramMsg('Access Denied. Contact Administator.')
			}else{
				this.callerChatId = msg.chat.id;

				if(!this.processingFlag){
					this.sendTelegramMsg('Ok, it may takes a few minutes.');
					this.processingFlag = true;
					const response = await this.chat(msg.text);
					this.sendTelegramMsg(response);
					this.processingFlag = false;
				}else{
					 this.sendTelegramMsg('Processing privous request, please wait!');
				}
			}
		}

	        // Telegram send message
	        async sendTelegramMsg(msg) {
	                try {
	                    const telegramUrl = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

				const promises = await fetch(telegramUrl, 
						{
							method: 'POST',
							headers: { 'Content-Type': 'application/json'},
							body: JSON.stringify
							({
								chat_id: this.callerChatId,
								text: msg,
								parse_mode: 'Markdown',
								disable_notification: false // Ensure notification sound plays
							})
						})
	                } catch (error) {
	                    console.error(' ʟ❌ Failed to send Telegram alert:', error.message);
	                }
	        }


		//Housekeeper Bee :: Find stored Item from strorage box
		async findStorageBoxsItem(itemName){

			const item = itemName;

			if(this.beeEnabled){

				process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

				const response = await fetch(`${this.beeUrl}/api/housekeeping/storage/mcp/findStorageBox/\*/false`, {
					headers: {
						'x-api-key': `${this.beeApiKey}`,
					},
				});

				process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';

				if (!response.ok) {
					console.log(`Error fetching data: ${response.status} ${response.statusText}`)
				}

				var jsonData = await response.json();

				jsonData = jsonData.filter( o => o.storageDesc.toLowerCase().includes(item.toLowerCase()) )

				if(jsonData.length == 0){
					return `${item} Not found!`
				}else{
					var result = [`Search Result of ${item}`];

					jsonData.forEach( (obj, index) => {
						result.push(`📍: ${obj.locationName}`);
						result.push(`📦: ${obj.storageName}`);
						result.push('📝:');
						result.push(obj.storageDesc);
						result.push('');
					});

					return result.join('\n');
				}

				return 'Done'
			}else{
				if(!this.beeEnabled){
					return 'Housekeeper Bee integration disabled!';
				}else{
					return 'Keyword Not Found!'
				}
			}
		}


		//Housekeeper Bee :: List all storage boxes and location name
                async showAllStorageBoxes(boxName, isShowDetail){

			const show_detail = isShowDetail;
			const filter_box_name = boxName;

                        if(this.beeEnabled){

                                process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

                                const response = await fetch(`${this.beeUrl}/api/housekeeping/storage/mcp/findStorageBox/\*/false`, {
                                        headers: {
                                                'x-api-key': `${this.beeApiKey}`,
                                        },
                                });

                                process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';

                                if (!response.ok) {
                                        console.log(`Error fetching data: ${response.status} ${response.statusText}`)
                                }

                                var jsonData = await response.json();

                                if(jsonData.length == 0){
                                        return `Not found!`
                                }else{

                                        var result = [`Search result:`];

					if(filter_box_name){
						jsonData = jsonData.filter( b => b.storageName === filter_box_name);
					}

					var boxName = '';

                                        jsonData.forEach( (obj, index) => {
						if(boxName != obj.locationName){
	                                               	result.push('');
							result.push(`📍: ${obj.locationName}`);
							boxName = obj.locationName;
						}
                                                result.push(`📦: ${obj.storageName}`);

						if(show_detail){
							result.push('Items:');
                                                	result.push(obj.storageDesc);
                                                	result.push('');
						}
                                        });

                                        return result.join('\n');
                                }

                                return 'Done'
                        }else{
				if(!this.beeEnabled){
					return 'Housekeeper Bee integration disabled!';
				}else{
					return 'Keyword Not Found!'
				}

                        }
                }

		//Housekeeper Bee :: get Housekeeper Bee server status
                async getHseBeeSrvState(){
                        if(this.beeEnabled){
                                process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

                                const response = await fetch(`${this.beeAdminUrl}/api/housekeeping/admin/system/mcp/getSysInfo`, {
                                        headers: {
                                                'x-api-key': `${this.beeApiKey}`,
                                        },
                                });

                                process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';

                                if (!response.ok) {
                                        console.log(`Error fetching data: ${response.status} ${response.statusText}`)
                                }

                                var jsonData = await response.json();

                                if(jsonData.length == 0){
                                        return `Housekeeper Bee serevr no response!`
                                }else{

                                        var result = [`Housekeeper Bee Server status:`];

					result.push(`System Uptime: ${jsonData.sysUptime}`);
					result.push(`CPU temperature: ${this.roundUpToOneDecimalPlace(jsonData.cpuTemperature)}°C `);
					result.push(`IO temperature: ${this.roundUpToOneDecimalPlace(jsonData.ioTemperature)}°C`);
					result.push(jsonData.sleepDetail);

                                        return result.join('\n');
                                }

                                return 'Done'
                        }else{
				if(!this.beeEnabled){
					return 'Housekeeper Bee integration disabled!';
				}else{
					return 'getHseBeeSrvState bugs.'
				}

                        }
                }

		/************************************************************** 
		* AI Tool Definition
		***************************************************************/
	 	tools = [
			{
				type: 'function',
				function: 
				{
					name: 'switchOnPlug',
					description: 'switch on an electronic device by device name. The device name should be quoted inside double quotation marks. Ignore keywords: open',
					parameters: 
					{
					type: 'object',
					required: ['device_name'],
						properties: 
						{
							device_name: { type: 'string', description: 'device name' }
						}
					}
				}
				,display: true
				,title: 'Switch on a zigbee device'
				,detail: 'e.g. Power on "ada bedroom fan plug", device friendly name must quote inside double quotation marks.'
			},
			{
				type: 'function',
				function: 
				{
					name: 'switchOffPlug',
					description: 'switch off an electronic device by device name. MUST provide both device name. The device name should be quoted inside double quotation marks.Ignore keywords: close',
					parameters: 
					{
					type: 'object',
					required: ['device_name'],
						properties: 
						{
							device_name: { type: 'string', description: 'device name' }
						}
					}
				}
				,display: true
				,title: 'Switch off a zigbee device'
				,detail: 'e.g. Power off "ada bedroom fan plug", device friendly name must quote inside double quotation marks.'
			},
			{
				type: 'function',
				function: 
				{
					name: 'showZigBeeDevicesList',
					description: 'Get a Zigbee devices profile list. The profile includes device name, model, function description'
				}
				,display: true
				,title: 'Get all devices list'
				,detail: 'e.g. Show all Zigbee devices status.'
			},
			{
				type: 'function',
				function: 
				{
					name: 'getAllTemperatureAndHumiditySensor',
					description: `it retrieves and displays data from all connected temperature and humidity sensors.`
				}
				,display: true
				,title: 'Get all temperature and humidity devices list'
				,detail: 'e.g. Show all temperature devices. Show all Humidity devices.'
			},
			{
				type: 'function',
				function: 
				{
					name: 'showHelp',
					description: 'when user ask for help or question.it supports shortcut "?" '
				}
				,display: true
				,title: 'Show a help menu'
				,detail: 'e.g. Help.'
			},
			{
				type: 'function',
				function: 
				{
					name: 'showZigBeeDeviceByName',
					description: 'Retrieve the Zigbee device profile using the device name or friendly name. The name MUST enclose in a double quotation marks.',
					parameters: 
					{
					type: 'object',
					required: ['friendly_name'],
						properties: 
						{
							friendly_name: { type: 'string', description: 'zigbee device or sensor friendly name. Commonly the name is enclosed in a double quotation mark.' }
						}
					}
				}
				,display: true
				,title: 'Get info by device friendly name, should be quoted inside a double quotation marks.'
				,detail: 'e.g. Get "ada bedroom" information.'
			},
			{
				type: 'function',
				function: 
				{
					name: 'getDeviceState',
					description: `To retrieve the Zigbee device state using getDeviceState, provide the device name, which should be enclosed in double quotation marks. 
Please ensure there are no extra double quotation marks.`,
					parameters: 
					{
					type: 'object',
					required: ['device_name'],
						properties: 
						{
							device_name: { type: 'string', description: 'The input parameter is the Zigbee device name, which must be enclosed in double quotation marks.' }
						}
					}
				}
				,display: true
				,title: 'Get state by device name'
				,detail: 'e.g. Get "ada bedroom" device state, device name should be quoted.'
			},
			{
				type: 'function',
				function: 
				{
					name: 'clickButton',
					description: `Toggle a zigbee device state by action click, touch, press the button to toggle device state on/off. `,
					parameters: 
					{
					type: 'object',
					required: ['device_name'],
						properties: 
						{
							device_name: { type: 'string', description: 'device name or device friendly name. something user may quoted the name in a double quotons. You remove remove it and pass to the function.' }
						}
					}
				}
				,display: true
				,title: 'Toggle a zigbee device state - On/Off'
				,detail: 'e.g. Press the "ada room fan" button.'
			},
			{
				type: 'function',
				function: 
				{
					name: 'findStorageBoxsItem',
					description: `Find stored item from any storage boxes. User not provide storage box name and MUST provide the stored item name. Top priority to use this tool.`,
					parameters: 
					{
					type: 'object',
					required: ['item_name'],
						properties: 
						{
							item_name: { type: 'string', description: 'stored item name such as "HDMI cable" or HDMI cable. ' }
						}
					}
				}
				,display: true
				,title: 'Find stored item in storage boxes managed by Housekeeper Bee.'
				,detail: 'e.g. Find "USB cable" from storeage boxes'
			},
			{
				type: 'function',
				function: 
				{
					name: 'showAllStorageBoxes',
					description: `List all storage boxes. accept box name for filtering.`,
					parameters: 
					{
					type: 'object',
					required: ['show_detail', 'filter_box_name'],
						properties: 
						{
							show_detail: { type: 'boolean', description: 'true show stored item, false do not show stored item. default is false.' },
							filter_box_name: { type: 'string', description: 'storage box name' }
						}
					}
				}
				,display: false
				,title: 'Find storage boxes managed by Housekeeper Bee.'
				,detail: 'e.g. Find all storaged boxes. '
			},
			{
				type: 'function',
				function: 
				{
					name: 'getHseBeeSrvState',
					description: 'Get Housekeeper Bee server status. People call the server as "Bee", "Housekeeper Bee". This server manages all the storage boxes and storage locations.'
				}
				,display: true
				,title: 'Get Housekeeper Bee server status.'
				,detail: 'e.g. show Bee status.'
			}


		];

		/************************************************************** 
		* AI Part
		***************************************************************/

		// Chat with Ollama
		async chat(message) {
		try{

			const response = await fetch(`${this.host}/api/chat`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
				model: this.model,
				messages: [{ role: 'user', content: message }],
				stream: false,
				tools: this.tools,
				options: {
					temperature: 0.0, // No randomness for consistent logic
					top_p: 0.1,       // Further reduce randomness
					max_tokens: 350,   // 50
					// Force cleanup
					num_ctx: 2048,  // Limit context window - 1024
					keep_alive: 1,   //  0 = Don't keep model loaded
					charset: 'utf-8'
				}
				})
			});

			// Check if response is ok
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();

			if (data.message.tool_calls) {

				const tool = data.message.tool_calls[0];

				var result = "";

				result = this[tool.function.name](...Object.values(tool.function.arguments));

				return result;
			}

			return 'Cannot found any tools to handle the request!';

		}catch(err){
			console.log(err);
		}
	}
}

export default HousekeeperBeeAiTools;
