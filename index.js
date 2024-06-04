const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

// middleware 
app.use(cors({
    origin: [
        'http://localhost:5173',
    ]
}))
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zxai2xc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const db = client.db("techAppsDB");
        const userCollection = db.collection("users");
        const productsCollection = db.collection("products");
        const allProductsCollection = db.collection("allProducts");
        const featuredCollection = db.collection("featured");
        const reportCollection = db.collection("report");


        // middlewares
        const verifyToken = (req, res, next) => {
            // console.log('inside verifyToken', req.headers);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            const token = req.headers.authorization.split(' ')[1]
            jwt.verify(
                token,
                process.env.ACCESS_TOKEN_SECRET,
                (err, decoded) => {
                    if (err) {
                        return res.status(401).send({ message: 'unauthorized access' })
                    }
                    req.decoded = decoded;
                    next();
                })
        }

        // user verify admin after verify token
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }


        // user verify moderator after verify token
        const verifyModerator = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query);
            const isModerator = user?.role === 'moderator';
            if (!isModerator) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }


        // jwt related api 
        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '365d' });
            res.send({ token });
        })

        // user collection 
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {

            const result = await userCollection.find().toArray();
            res.send(result)
        })


        // admin route 
        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin'
            }
            res.send({ admin })

        })

        // moderator route
        app.get('/users/moderator/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            console.log(email);
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            let moderator = false;
            if (user) {
                moderator = user?.role === 'moderator'
            }
            res.send({ moderator })
        })


        app.post('/users', async (req, res) => {
            const user = req.body;

            // insert email if user doesn't exists:
            const query = { email: user?.email };
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'User already exists', insertedId: null })
            }

            const result = await userCollection.insertOne(user);
            res.send(result)
        })

        app.patch('/users/admin/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const query = req.body;
            console.log(query);
            const updatedDoc = {
                $set: {
                    role: query.role
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result)

        })


        app.delete('/users/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })


        // products related api 
        app.get('/products', verifyToken, async (req, res) => {
            const result = await productsCollection.find().toArray();
            res.send(result);
        })

        app.get('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };

            const result = await productsCollection.findOne(query);
            res.send(result);
        })

        app.get('/product/:email', async (req, res) => {
            const query = { email: req.params.email }
            const result = await productsCollection.find(query).toArray();
            res.send(result)
        })

        app.post('/products', async (req, res) => {
            const query = req.body;
            const result = await productsCollection.insertOne(query);
            res.send(result)
        })

        app.put('/products/:id', async (req, res) => {
            const id = req.params.id
            const status = req.body
            console.log(status);
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: status
            }
            const result = await productsCollection.updateOne(query, updateDoc)
            res.send(result)
        })


        // allProducts related api

        app.get('/allProducts', async (req, res) => {

            const filter = req.query;

            const queryTitle = {
                tags: { $regex: filter.search, $options: 'i' }
            }

            const result = await allProductsCollection.find(queryTitle).toArray();
            res.send(result);
        })

        app.post('/allProducts', async (req, res) => {
            const query = req.body;
            const filter = await allProductsCollection.findOne(query);
            if (filter) {
                return res.send({ message: 'Product already exists', insertedId: null })
            }
            const result = await allProductsCollection.insertOne(query);

            res.send(result);

        })

        app.delete('/allProducts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: id }
            const result = await allProductsCollection.deleteOne(query);
            res.send(result);
        })


        // featured related api
        app.get('/featured', async (req, res) => {
            const result = await featuredCollection.find().toArray();
            res.send(result);
        })

        app.post('/featured', async (req, res) => {
            const query = req.body;

            const filter = await featuredCollection.findOne(query);
            if (filter) {
                return res.send({ message: 'Featured already exists', insertedId: null })
            }
            const result = await featuredCollection.insertOne(query);
            res.send(result);

        })

        // reported Product api 

        app.get('/reportedProduct', async (req, res) => {
            const result = await reportCollection.find().toArray();
            res.send(result)
        })

        app.post('/reportedProduct', async (req, res) => {
            const query = req.body;
            const result = await reportCollection.insertOne(query);
            res.send(query);
        })

        app.delete('/reportedProduct/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: id }
            const result = await reportCollection.deleteOne(query);
            res.send(result);
        })


        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Tech Apps is running')
})

app.listen(port, () => {
    console.log(`The server is running on port ${port}`);
})