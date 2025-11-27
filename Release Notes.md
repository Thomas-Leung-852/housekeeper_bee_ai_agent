# RELEASE NOTE

### Version: v1.3.0
### Release Date: 2025/11/27  
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
### Changes:

### Added
Added `env.prod.template`

### Modified
.gitignore - ignore `.env.prod` prevents overwrite this file when updating files from remote.

---
### Version: v1.2.0
### Release Date: 2025/11/25  
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

