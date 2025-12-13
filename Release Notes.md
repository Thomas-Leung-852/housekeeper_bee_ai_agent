# RELEASE NOTE
### Version: v1.5.0
### Release Date: 2025/12/14
----  
### ✦ Changes:
#### [Added]

Added: Hyperlinks to open the storage box, embedded in the Telegram reply message.     
Added: Functionality to allow searching by tag name.     
Added: Functionality to allow searching by storage code.     

### ✦ Setup procedure
Add Enviornment variable to `.env.prod` file.    

📱Open Telegram App ➜ BotFather ➜ /mybots ➜ You can get the bot name from the reply message.     

```
TLG_BOT_NAME={@Telegram bot name}  #Example: @My_Bee_bot
```
### ✦ Usage

Commands:    
```
show all boxes, tagged toys, usb or winter
```

```
show all boxes, tagged usb and charger.
```

### ✦ Requirement

Housekeeper Bee Version 1.6.2

---

### Version: v1.4.0
### Release Date: 2025/12/05
----  
### Changes:
### [Added]

**Created a Redis Docker container to maintain prompt history, which is user-based. Each user has their own prompt history. If idle for 30 minutes, the prompt history will be deleted when using cloud model.**

### Setup

- For new users, run `setup_all.sh` for a full installation.
- To update the version, run `35_redis_setup.sh` to set up the Redis Docker container and configure it to run automatically on system boot. The file can be found in the `setup` folder.

Reboot the Raspberry Pi and wait for Docker to load.

### Checking

Run the following command to check running containers:

```bash
docker ps
```

### Install Node.js Redis Dependency

```
npm i redis
```

### [Modified]

### [ * ] Use model support thinking mode.
Ollama's "think" mode enables models to show their step-by-step reasoning process, which is useful for building smarter AI agents and auditing complex decisions

### [ * ] When to use thinking mode   
- Complex problem-solving: For situations requiring detailed step-by-step logic, such as solving math problems or debugging code.   
- Creative tasks: To explore multiple angles or ideas for creative writing, content generation, or brainstorming, as it allows the AI to generate more ideas internally before giving a final response.    
- Auditing and debugging: To understand exactly how the model arrived at a specific answer to audit its steps or debug issues.     
- User experience: To build applications with a "thinking bubble" animation before the final response appears, creating a more engaging user experience.     

### [ * ] Procedure

- Add model support `thinking` mode.
- Add new environment variables.
- Add Node js dependency. 

### [ * ] Action

### - Add model support `thinking` mode.

**Model**: gpt-oss:20b-cloud    
**Support**: tools, thinking and cloud    
**Description**:    
gpt-oss-20b model is designed for lower latency, multiple languages - Traditional Chinese or specialized use-cases.  

#### Remote update 

Step 1: In Windows, open a new terminal 

Command  
```
ssh {user name}@{ip address}
```

Example    
```
ssh thomas@192.128.10.100
```

Step 2: Download Ollama model

Commands
```
# enter bash shell

docker exec -it ollama bash

# download model

ollama run gpt-oss:20b-cloud

# check model list

ollama list

# Exit bash shell

exit
```

### - Add new environment variables

Edit the environment variables file

```
sudo nano .env.prod
```

Update the variables

```
# In Ollama section 
# Change environment variable value 

OLLAMA_MODEL_TW_CHN=gpt-oss:20b-cloud 
OLLAMA_API_KEY={your API Key from Ollama site}
OLLAMA_ENV=cloud  

# Add environment variable

OLLAMA_THINKING=true   
```

### - Add Node js dependency 

Install a Node library to convert Markdown to HTML for better readability on mobile devices.
```
npm i marked
```

---
### Version: v1.3.0
### Release Date: 2025/11/27  
---
### Changes:

### [Modified]

### Adding Ollama Cloud to utilize a remote model has improved performance and reduced roundtrip time.

### To apply this version change, you need to do the following:

1. Update Ollama from version 0.11.0 to 0.12.0 or higher.
2. Install Ollama Node Library.
3. Obtain an API key from the Ollama website. 
4. Update the model name and add the API key in the .env.prod file.

### Here are the commands:

**[ * ] Update Ollama Docker Image (to run Ollama Cloud version v0.12.0 or higher)**

- Step 1: Check your Ollama version. If it's lower than the required version, continue.

   `docker exec ollama ollama -v`

- Step 2: Update the Docker image.

  `docker pull ollama/ollama:latest`

- Step 3: Reboot after updating the Docker image. The Docker container will then use the latest version of Ollama (v0.13.0).

  `sudo reboot`   

**[ * ] Install Ollama Node Library**

- Install the dependency.    

   `npm i ollama`   

**[ * ] Apply the Ollama Cloud API key.**

   - Sign in to the Ollama website (https://www.ollama.com/). 
   - Go to ***Settings***.
   - Click on the ***Keys*** section.
   - Create a new API key.

**[ * ] Update the model name and add the API key in the .env.prod file:**

```
OLLAMA_MODEL_TW_CHN=qwen3-coder:480b-cloud      
OLLAMA_API_KEY={ollama cloud api key}    
OLLAMA_ENV=cloud    
```   

---
### Version: v1.2.1
### Release Date: 2025/11/25  
---
### Changes:

### Added
Added `env.prod.template`

### Modified
.gitignore - ignore `.env.prod` prevents overwrite this file when updating files from remote.

---
### Version: v1.2.0
### Release Date: 2025/11/25 
--- 
### Changes:

### Added    
#### 1. Message TTL
Added a message time-to-live (TTL), with a default of 15 minutes.  
     
1.1. Reply messages will be deleted after 15 minutes by default.   
1.2. To override the default setting, add ```TLG_TTL_IN_MINUTE=5``` in the .env.prod file.     
The value must be between 5 and 720 minutes; otherwise, the default setting will apply.


#### 2. Timeout 
Add a timeout mechanism to abort long LLM processing requests that exceed 4 minutes.

### Modified
#### 1. Execute Multiple Tools in a Prompt
#### 2. Change the model parameters     
   2.1 Temperature: Set to 0.0 for consistent and focused output; set to 1.0 or higher for creative and less predictable results, increasing randomness for consistent logic.

   *Overall Configuration Profile - official site https://ollama.com/library/qwen3:1.7b/blobs/cff3f395ef37*    
This configuration creates a balanced, reliable output that's:

   - Moderately deterministic (temp 0.6)
   - Focused on high-probability tokens (top_k 20, top_p 0.95)
   - Doesn't artificially suppress repetition (repeat_penalty 1)
   - Properly stops at message boundaries

---
### Version: v1.1.0
### Release Date: 2025/10/02 
--- 
### Changes:
1. Bugs Fixed    
2. Allow checking the Housekeeper Bee Server state    
a. Update the HOUSEKEEPER_BEE_ENABLED to true    
b. Update the HOUSEKEEPER_BEE_ADMIN_URL to Housekeeper Bee administration server URL (e.g. 192.168.50.222:8088)
3. Allow getting the temperature and humidity sensors measurements.

---
### Version: v1.0.0  
### Release Date: 2025/09/15    
### Changes:

### initial release

