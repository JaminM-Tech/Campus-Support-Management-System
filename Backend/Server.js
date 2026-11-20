
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

app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Serve frontend files from the root public folder.
const frontendPath = path.join(__dirname, "../public");

app.use(express.static(frontendPath));

app.get("/", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
});

// MongoDB collection names.
const allowedCollections = [
    "students",
    "courses",
    "payments",
    "supportRequests"
];

// Validate collection names.
function getExistingCollection(name) {
    if (!allowedCollections.includes(name)) {
        throw new Error("Collection not recognised.");
    }

    return getDatabase().collection(name);
}

// Validate document data.
function isValidDocument(data) {
    return (
        data !== null &&
        typeof data === "object" &&
        !Array.isArray(data)
    );
}

// Connect to MongoDB before API requests.
app.use("/api", async (req, res, next) => {
    try {
        await connectDatabase();
        next();
    } catch (error) {
        console.error("Database connection error:", error);

        res.status(503).json({
            error: "Unable to connect to the database."
        });
    }
});

// Backend status.
app.get("/api/status", (req, res) => {
    res.json({
        message: "Campus Support Backend is running!",
        status: "Connected",
        database: process.env.DB_NAME
    });
});

// Get all collections and record counts.
app.get("/api/collections", async (req, res) => {
    try {
        const db = getDatabase();

        const results = await Promise.all(
            allowedCollections.map(async (name) => {
                const count = await db
                    .collection(name)
                    .countDocuments();

                return { name, count };
            })
        );

        res.json(results);
    } catch (error) {
        console.error("Collections error:", error);

        res.status(500).json({
            error: "Unable to load collections."
        });
    }
});

// Retrieve records.
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
        res.status(400).json({ error: error.message });
    }
});

// Add a record.
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
        delete newRecord._id;

        if (!Object.keys(newRecord).length) {
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
        console.error("Insert error:", error);

        res.status(400).json({ error: error.message });
    }
});

// Update a record.
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
        delete updatedFields._id;

        const result = await collection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updatedFields }
        );

        if (!result.matchedCount) {
            return res.status(404).json({
                error: "Record not found."
            });
        }

        res.json({
            message: "Record updated successfully."
        });
    } catch (error) {
        console.error("Update error:", error);

        res.status(400).json({ error: error.message });
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

        if (!result.deletedCount) {
            return res.status(404).json({
                error: "Record not found."
            });
        }

        res.json({
            message: "Record deleted successfully."
        });
    } catch (error) {
        console.error("Delete error:", error);

        res.status(400).json({ error: error.message });
    }
});

// Invalid API routes.
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

// Start server locally.
if (require.main === module) {
    const PORT = process.env.PORT || 5000;

    connectDatabase()
        .then(() => {
            app.listen(PORT, () => {
                console.log(
                    `Campus Support running at http://localhost:${PORT}`
                );
            });
        })
        .catch((error) => {
            console.error(
                "Application could not start:",
                error.message
            );

            process.exit(1);
        });

    process.on("SIGINT", async () => {
        await closeDatabase();
        process.exit(0);
    });
}

module.exports = app;
