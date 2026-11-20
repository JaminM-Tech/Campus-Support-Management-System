
const { MongoClient } = require("mongodb");
const path = require("path");

require("dotenv").config({
    path: path.resolve(__dirname, "../.env")
});

const uri = process.env.MONGODB_URI;
const databaseName = process.env.DB_NAME;

if (!uri) {
    throw new Error("MONGODB_URI is missing.");
}

if (!databaseName) {
    throw new Error("DB_NAME is missing.");
}

const client = new MongoClient(uri);

let database;
let connectionPromise;

async function connectDatabase() {
    if (database) {
        return database;
    }

    if (!connectionPromise) {
        connectionPromise = client.connect()
            .then(() => {
                database = client.db(databaseName);

                console.log("MongoDB connected successfully!");
                console.log("Database:", databaseName);

                return database;
            })
            .catch((error) => {
                connectionPromise = null;
                throw error;
            });
    }

    return connectionPromise;
}

function getDatabase() {
    if (!database) {
        throw new Error("Database has not been connected.");
    }

    return database;
}

async function closeDatabase() {
    if (connectionPromise) {
        await connectionPromise.catch(() => {});
    }

    await client.close();
    database = null;
    connectionPromise = null;
}

module.exports = {
    connectDatabase,
    getDatabase,
    closeDatabase
};
