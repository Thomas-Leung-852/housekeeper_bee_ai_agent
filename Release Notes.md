# RELEASE NOTE
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

