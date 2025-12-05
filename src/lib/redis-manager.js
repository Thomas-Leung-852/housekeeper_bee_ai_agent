import { createClient } from 'redis';

class SessionStore {
    
    constructor(aKeyPrefix, aExpiryMinutes = 30) {
        this.redis = createClient({
            host: '127.0.0.1', // Your Redis server address
            port: 6379          // Your Redis server port
        });

        this.isConnected = false; // Connection status flag

        this.redis.on('connect', () => {
            console.log('Connected to Redis...');
            this.isConnected = true; // Set flag to true on successful connection
        });

        this.redis.on('error', (err) => {
            console.error('Redis error:', err);
            this.isConnected = false; // Reset flag on error
        });

        this.expiryMinutes = aExpiryMinutes;
        this.keyPrefix = aKeyPrefix;
    }

    async connect() {
        await this.redis.connect();
    }

    // Save/Update value - RESETS TTL
    async save(chatId, value) {
        const key = `${this.keyPrefix}:${chatId}`;
        await this.redis.setEx(key, this.expiryMinutes * 60, value);
    }

    // Save/Update value - RESETS TTL
    async saveArray(chatId, array) {
        const key = `${this.keyPrefix}:${chatId}`;
        const value = JSON.stringify(array);
        await this.redis.setEx(key, this.expiryMinutes * 60, value);
    }

    // Get value and auto-refresh TTL on access
    async getArrayAndRefresh(chatId) {
        const key = `${this.keyPrefix}:${chatId}`;
        const value = await this.redis.get(key);

        if (!value) {
            console.log('❌ value not found');
            return null;
        }

        // Reset TTL every time value is accessed
        await this.redis.setEx(key, this.expiryMinutes * 60, value);
        return value ? JSON.parse(value) : [];
    }

    // Get value WITHOUT refreshing TTL
    async getArray(chatId) {
        const key = `${this.keyPrefix}:${chatId}`;
        const value = await this.redis.get(key);
        return value ? JSON.parse(value) : [];
    }

    // Get value and auto-refresh TTL on access
    async getAndRefresh(chatId) {
        const key = `${this.keyPrefix}:${chatId}`;
        const value = await this.redis.get(key);

        if (!value) {
            console.log('❌ value not found');
            return null;
        }

        // Reset TTL every time value is accessed
        await this.redis.setEx(key, this.expiryMinutes * 60, value);
        return value;
    }

    // Get value WITHOUT refreshing TTL
    async get(chatId) {
        const key = `${this.keyPrefix}:${chatId}`;
        return await this.redis.get(key);
    }

    async del(chatId) {
        const key = `${this.keyPrefix}:${chatId}`;
        return await this.redis.del(key);
    }

    // Manually refresh TTL without changing value
    async refreshTTL(chatId, newExpiryMinutes = null) {
        const key = `${this.keyPrefix}:${chatId}`;
        const value = await this.redis.get(key);

        if (!value) {
            console.log('❌ No value to refresh');
            return false;
        }

        const expiry = newExpiryMinutes || this.expiryMinutes;

        // Use setEx to reset TTL
        await this.redis.setEx(key, expiry * 60, value);

        return true;
    }

    // Get TTL info
    async getTTLInfo(chatId) {
        const key = `${this.keyPrefix}:${chatId}`;
        const ttl = await this.redis.ttl(key);

        if (ttl === -2) {
            return { exists: false, message: 'value does not exist' };
        }

        if (ttl === -1) {
            return { exists: true, message: 'value never expires' };
        }

        const minutes = Math.floor(ttl / 60);
        const seconds = ttl % 60;

        return {
            exists: true,
            totalSeconds: ttl,
            minutes,
            seconds,
            message: `Expires in ${minutes}m ${seconds}s`
        };
    }

    // Method to gracefully close the connection
    async close() {
        await new Promise((resolve) => {
            this.redis.quit(() => {
                this.isConnected = false;
                resolve();
            });
        });
        console.log('Connection to Redis closed.');
    }

    quit() {
        this.redis.quit();
        this.isConnected = false; // Reset the connection status
    }

    // Method to check connection status
    checkConnection() {
        return this.isConnected;
    }
}

export { SessionStore };

