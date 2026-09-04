module.exports = {
    apps: [
        {
            name: "isms-jai",
            script: "node_modules/next/dist/bin/next",
            args: "start -p 3009",
            cwd: __dirname,
            watch: false,
            max_memory_restart: "512M",
            env: {
                NODE_ENV: "production"
            }
        }
    ]
};