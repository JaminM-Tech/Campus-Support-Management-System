const express = require("express");
const cors = require("cors");
const path = require("path");
const { ObjectId } = require("mongodb");

const {
    connectDatabase,
    getDatabase,
    closeDatabase
} = require("./Database");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Serve the frontend.
const frontendPath = path.join(__dirname, "../Frontend");

app.use(express.static(frontendPath));

app.get("/", (req, res) => {
    res.sendFile(path.join(frontendPath, "Index.html"));
});

// Only allow the collections used by this project.
const allowedCollections = [
    "students",
    "courses",
    "payments",
    "supportRequests"
];

function getExistingCollection(name) {
    if (!allowedCollections.includes(name)) {
        throw new Error("Collection not recognised.");
    }

    return getDatabase().collection(name);
}

function isValidDocument(data) {
    return (
        data !== null &&
        typeof data === "object" &&
        !Array.isArray(data)
    );
}

// Backend status.
app.get("/api/status", (req, res) => {
    res.json({
        message: "Campus Support Backend is running!",
        status: "Connected",
        database: process.env.DB_NAME
    });
});

// Get all collections and their record counts.
app.get("/api/collections", async (req, res) => {
    try {
        const db = getDatabase();

        const results = await Promise.all(
            allowedCollections.map(async (name) => {
                const collection = db.collection(name);
                const count = await collection.countDocuments();

                return {
                    name,
                    count
                };
            })
        );

        res.json(results);
    } catch (error) {
        console.error("Collections error:", error);

        res.status(500).json({
            error: "Unable to load collections.",
            details: error.message
        });
    }
});

// Retrieve records from a collection.
app.get("/api/records/:collection", async (req, res) => {
    try {
        const collection = getExistingCollection(
            req.params.collection
        );

        const records = await collection
            .find({})
            .sort({ _id: -1 })
            .limit(1000)
            .toArray();

        res.json(records);
    } catch (error) {
        console.error("Fetch records error:", error);

        res.status(400).json({
            error: error.message
        });
    }
});

// Add a new record.
app.post("/api/records/:collection", async (req, res) => {
    try {
        const collection = getExistingCollection(
            req.params.collection
        );

        if (!isValidDocument(req.body)) {
            return res.status(400).json({
                error: "A valid record is required."
            });
        }

        const newRecord = { ...req.body };

        // MongoDB generates its own _id.
        delete newRecord._id;

        if (Object.keys(newRecord).length === 0) {
            return res.status(400).json({
                error: "The record cannot be empty."
            });
        }

        const result = await collection.insertOne(newRecord);

        res.status(201).json({
            message: "Record added successfully.",
            insertedId: result.insertedId
        });
    } catch (error) {
        console.error("Add record error:", error);

        res.status(400).json({
            error: error.message
        });
    }
});

// Update an existing record.
app.put("/api/records/:collection/:id", async (req, res) => {
    try {
        const collection = getExistingCollection(
            req.params.collection
        );

        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                error: "Invalid record ID."
            });
        }

        if (!isValidDocument(req.body)) {
            return res.status(400).json({
                error: "A valid record is required."
            });
        }

        const updatedFields = { ...req.body };

        // Never allow a form to overwrite MongoDB's _id.
        delete updatedFields._id;

        const result = await collection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updatedFields }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                error: "Record not found."
            });
        }

        res.json({
            message: "Record updated successfully."
        });
    } catch (error) {
        console.error("Update record error:", error);

        res.status(400).json({
            error: error.message
        });
    }
});

// Delete a record.
app.delete("/api/records/:collection/:id", async (req, res) => {
    try {
        const collection = getExistingCollection(
            req.params.collection
        );

        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                error: "Invalid record ID."
            });
        }

        const result = await collection.deleteOne({
            _id: new ObjectId(id)
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                error: "Record not found."
            });
        }

        res.json({
            message: "Record deleted successfully."
        });
    } catch (error) {
        console.error("Delete record error:", error);

        res.status(400).json({
            error: error.message
        });
    }
});

// Handle invalid API routes.
app.use("/api", (req, res) => {
    res.status(404).json({
        error: "API endpoint not found."
    });
});

// General error handler.
app.use((error, req, res, next) => {
    console.error("Server error:", error);

    res.status(500).json({
        error: "An unexpected server error occurred."
    });
});

// Start the application after connecting to MongoDB.
async function startServer() {
    try {
        await connectDatabase();

        app.listen(PORT, () => {
            console.log("-----------------------------------");
            console.log("Campus Support Management System");
            console.log(`Server running at http://localhost:${PORT}`);
            console.log("-----------------------------------");
        });
    } catch (error) {
        console.error("Application could not start:", error.message);
        process.exit(1);
    }
}

process.on("SIGINT", async () => {
    console.log("\nClosing application...");

    try {
        await closeDatabase();
    } finally {
        process.exit(0);
    }
});

startServer();