import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'e2e',workers:1,use:{baseURL:'http://localhost:4200',channel:process.env['BROWSER_CHANNEL']||'chrome'},webServer:{command:'npm start -- --host 127.0.0.1',url:'http://127.0.0.1:4200',reuseExistingServer:true,timeout:120000}});

