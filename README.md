# 🐝 Housekeeper Bee AI Agent

**Smart Home Storage Management Made Simple with AI**

The Housekeeper Bee AI Agent is an intelligent extension of the Housekeeper Bee Server that revolutionizes how you manage and monitor your home storage systems. By combining the power of AI with natural language processing, this project transforms complex storage management into effortless conversations through Telegram.   

<table>
<tr>
<td valign="top">
<img src="https://static.wixstatic.com/media/0d7edc_c8b3a567bd9f45cd97c3183e556e782e~mv2.jpg" height="540"> 
</td>
<td>
&nbsp;
</td>
<td> 
<img src="https://static.wixstatic.com/media/0d7edc_9e8bbf8e344a4bfd80ae6c62ba883f5e~mv2.png" width="250">
</td>
</tr>
</table>

## 🎯 What It Does

The Housekeeper Bee AI Agent serves as your personal storage assistant, providing:

- **Natural Language Storage Queries**:    
Ask questions like <font color=yellow>***Where did I put my "HDMI cable"?***</font> or 
<font color=yellow>***What is in "Blue Paper box" storage?***</font> using plain English through Telegram
- **Intelligent Zigbee Device Monitoring**:        
Automatically tracks temperature and humidity levels across your storage areas    

- **Proactive Climate Alerts**:     
Sends instant Telegram notifications when temperature thresholds are exceeded to protect your stored items    

- **Device Status Insights**:     
Query Zigbee device profiles and current states using conversational language    

- **Smart Storage Analytics**:     
Get AI-powered insights about your storage patterns and recommendations

## 🚀 How AI Makes Your Life Easier

### Conversational Storage Management
No more remembering cryptic box numbers or location codes. Simply chat with the AI agent through Telegram:
- ***Show me all boxes without details***
- ***Show all items in "Ada paper box" storage.***
- ***Check "Son bedroom" state.***
- ***Click the "Ada bedroom fan" button.***

### Proactive Protection
The AI continuously monitors environmental conditions and alerts you before problems occur:
- Prevents damage to sensitive items from excessive heat or humidity
- Learns your storage patterns to provide personalized recommendations

### Seamless Integration
- **Telegram Bot Interface**: Manage everything from your phone with natural conversations
- **Zigbee2MQTT Integration**: Works with your existing smart home ecosystem
- **Temperature Intelligence**: Uses smart thresholds (Cool: 0-10°C, Good: 11-20°C, Hot: 21-30°C, Very Hot: 31-36°C, Extremely Hot: 37°C+)

## 🏠 Perfect For

- **Organized Homeowners**: Keep track of seasonal items, documents, and valuables
- **Smart Home Enthusiasts**: Integrate storage management with existing automation
- **Busy Families**: Never lose track of important items again
- **Collectors & Hobbyists**: Protect valuable collections with climate monitoring

## 🛠️ Built With

- AI-powered natural language processing
- Telegram Bot API for seamless mobile interaction
- Zigbee2MQTT for reliable IoT device communication
- Integration with Housekeeper Bee Server infrastructure

## 🌟 Why Choose Housekeeper Bee AI Agent?

Transform your storage chaos into organized simplicity. No more digging through boxes, no more damaged items from poor storage conditions, and no more wondering where you put something. The AI agent learns your habits, protects your belongings, and puts intelligent storage management right at your fingertips through simple conversations.

*Ready to make storage management effortless? Let the Housekeeper Bee AI Agent buzz into action for you!*

## 📋 Technical Requirements & Setup

### Prerequisites
Before setting up the Housekeeper Bee AI Agent, ensure you have:

- **Raspberry Pi 5** with Housekeeper Bee Server installed and running
- **Telegram Account** for bot creation and management
- **Network Access** between AI Agent and Housekeeper Bee Server

### Pre-Installation Steps

1. **Install Housekeeper Bee Server**
   - Deploy the Housekeeper Bee Server on your Raspberry Pi 5
   - Ensure the server is accessible on your local network
   - Note down the server URL (e.g., `http://192.168.1.100:8080`)

2. **Create Telegram Bot**
   - Contact [@BotFather](https://t.me/botfather) on Telegram
   - Create a new bot and obtain your **Bot Token**
   - Get your **Chat ID** (personal or group chat where notifications will be sent)
   - Test the bot to ensure it's working properly

### Configuration

After installation, configure the AI Agent:  

Step 1: copy the `.env.prod.template` to `.env.prod`    
Step 2: update the `.env.prod` file with:

```env
# Housekeeper Bee Server Configuration
HOUSEKEEPER_SERVER_URL=http://your-rpi5-ip:port
HOUSEKEEPER_BEE_API_KEY= {your_api_key}***

# Telegram Bot Configuration  
TLG_BOT_TOKEN=your_bot_token_here
TLG_CHAT_ID_LIST=your_chat_id_here

# Threshold
TEMPERATURE_THRESHOLD=31.0
HUMIDITY_THRESHOLD=90.0
```

### Quick Setup Checklist
- [ ] Raspberry Pi 5 with Housekeeper Bee Server running
- [ ] Telegram bot created with valid token
- [ ] Chat ID obtained and tested
- [ ] Network connectivity verified
- [ ] `.env.prod` file configured with all required parameters
- [ ] AI Agent service started and connected

---

**Status**: ✅ Development Complete | 🧪 Testing Complete | 🚀 Ready for Release

---

###   Use Case - Ada's Smart Home Rescue
It's a scorching summer afternoon, and Ada is stuck in traffic on her way home from the office. As the AC blasts in her car, she suddenly remembers—she forgot to turn on the fan in her living room before leaving this morning. Her apartment is probably turning into an oven right now.   

Without taking her hands off the wheel, she activates Siri through CarPlay.   

"Hey Siri, send a message to Housekeeper Bee Bot on Telegram."   

Siri responds: "What do you want to say?"   

Ada speaks clearly: "What's the living room temperature and server status? If it's over 30 degrees Celsius or the CPU is running hot—over 40 degrees—turn on the living room fan."    

"Ready to send it?" Siri confirms.   

"Yeah, send it."   

Within seconds, her AI agent processes the request and sends back a response. Since Ada has "Announce Messages" enabled, Siri reads the reply aloud through her car speakers:
"Living room temperature is 32 degrees Celsius. CPU temperature is 37 degrees. Turning on the living room fan now. Your space should cool down in about 15 minutes."   

Ada smiles and relaxes back into her seat. Crisis averted—without ever touching her phone.


![](https://static.wixstatic.com/media/0d7edc_9b0cee3c725a4183998141b0c5db208a~mv2.png)


## YouTube

Use Case, message processing flow and Demonstration

[![](https://img.youtube.com/vi/1yYoudWtvUM/0.jpg)](https://www.youtube.com/watch?v=1yYoudWtvUM)
