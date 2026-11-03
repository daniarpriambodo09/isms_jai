module.exports = {
    apps: [
        {
            name: "isms-jai",
            script: "node_modules/next/dist/bin/next",
            args: "start -p 3009",
            cwd: __dirname,
            autorestart: true,          // Otomatis hidupkan kembali jika aplikasi crash
            watch: false,               // Mencegah restart loop saat file log bertambah
            restart_delay: 5000,        // Jeda 5 detik sebelum mencoba restart ulang
            max_restarts: 10,           // Batas maksimal percobaan restart berturut-turut
            max_memory_restart: "512M", // Restart otomatis jika pemakaian RAM melebihi batas
            windowsHide: true,          // Mencegah pop-up jendela terminal di Windows
            time: true,                 // Memberikan timestamp [YYYY-MM-DD HH:mm:ss] di log
            out_file: "logs/isms-out.log",
            error_file: "logs/isms-error.log",
            env: {
                NODE_ENV: "production",
                PORT: 3009
            }
        }
    ]
};