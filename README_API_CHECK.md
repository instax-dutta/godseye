# API Check Script

You can verify your deployed monitoring API by running:

```sh
npm install node-fetch@2
node api_check.js
```

This script checks the /websites endpoint and tries to fetch results for the first website. If you see JSON output for both, your API and proxy are working. If you see errors or HTML, check your Vercel proxy config.

- The script uses the deployed Vercel proxy by default but you can pass a custom API base URL as an argument:
  
  ```sh
  node api_check.js https://godseye.vercel.app/api
  ```
