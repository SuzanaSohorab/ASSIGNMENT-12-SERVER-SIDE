
const express =require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require('cors');
const app =express();
const port = process.env.PORT || 5000;
//middleware
app.use(cors());
app.use(express.json());

app.get('/' ,( req, res) =>{
  res.send("simple forum wevsite is running") 

});

app.listen(port ,() =>{
  console.log(`Forum website is running on , ${port}`);
})

//user-forumUser
//paas-AFtva5SP9eVemOlB
const uri = "mongodb+srv://forumDB:XnSo18x87U52j8HG@cluster0.joiywm2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

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
    const userCollection =client.db("forumDB").collection("users")

    app.post('/users' , async(req ,res)=>{
      const user =req.body;
      console.log('data in server' , user);

      const result =await userCollection.insertOne(user);
      res.send(result);
    })
    await client.db('admin').command({ping:1})
    console.log("pinged Your deployment");
  }
  finally{
    

  }
  
}
run().catch(console.dir)











