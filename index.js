
const express =require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require('cors');
const app =express();
const port = process.env.PORT || 5000;

//user-forumUser
//paas-AFtva5SP9eVemOlB
const uri = "mongodb+srv://Forum-website:AFtva5SP9eVemOlB@cluster0.joiywm2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try{
    await client.connect();
    await client.db('admin').command({ping:1})
    console.log("pinged Your deployment");
  }
  finally{
    

  }
  
}
run().catch(console.dir)

//middleware
app.use(cors());
app.use(express.json());

app.get('/' ,( req, res) =>{
  res.send("simple forum wevsite is running") 

});

app.listen(port ,() =>{
  console.log(`Forum website is running on , ${port}`);
})










// import express from "express";
// import cors from "cors";
// import dotenv from "dotenv";
// import { MongoClient } from "mongodb";

// dotenv.config();
// const app = express();

// app.use(cors());
// app.use(express.json());

// const port = process.env.PORT || 5000;

// // MongoDB client
// const client = new MongoClient(process.env.MONGO_URI, {
//   useUnifiedTopology: true,
// });

// // Global collections
// let postsCollection;
// let commentsCollection;
// let announcementsCollection;

// async function run() {
//   try {
//     await client.connect();
//     const db = client.db(process.env.DB_NAME);

//     postsCollection = db.collection("posts");
//     commentsCollection = db.collection("comments");
//     announcementsCollection = db.collection("announcements");

//     console.log("✅ MongoDB connected");

//     // Example test route
//     app.get("/", (req, res) => {
//       res.send("Forum server running!");
//     });

//     // Example: insert post
//     app.post("/posts", async (req, res) => {
//       const doc = { ...req.body, createdAt: new Date(), upVote: 0, downVote: 0 };
//       const result = await postsCollection.insertOne(doc);
//       res.json(result);
//     });

//     // Example: get all posts
//     app.get("/posts", async (req, res) => {
//       const posts = await postsCollection.find().sort({ createdAt: -1 }).toArray();
//       res.json(posts);
//     });

//     app.listen(port, () => {
//       console.log(`🚀 Server running on port ${port}`);
//     });
//   } catch (err) {
//     console.error("❌ Error connecting to MongoDB", err);
//   }
// }
// run();
