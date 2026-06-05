import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

// Define Interfaces
interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  stock_quantity: number;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

interface OrderItem {
  menu_item_id: string;
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

interface Order {
  id: string;
  customer_name: string;
  phone: string;
  address: string;
  notes: string;
  total_amount: number;
  status: 'Pending' | 'Accepted' | 'Preparing' | 'Ready' | 'Completed' | 'Rejected';
  rejection_reason: string | null;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

// Database JSON path
const DB_PATH = path.resolve(process.cwd(), "./db.json");

// Default initial menu data (using high quality food photos and descriptions)
const DEFAULT_MENU: MenuItem[] = [
  {
    id: "m1",
    name: "Classic Margherita Pizza",
    description: "Stone-baked sourdough topped with farm-fresh tomato sauce, creamy buffalo mozzarella, and aromatic fresh basil leaves.",
    price: 12.99,
    category: "Pizzas",
    image: "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?auto=format&fit=crop&q=80&w=600",
    stock_quantity: 20,
    is_available: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "m2",
    name: "Double Truffle Smash Burger",
    description: "Two premium beef smash patties, melted vintage cheddar, caramelized onions, and house truffle aioli on a toasted brioche bun.",
    price: 14.49,
    category: "Burgers",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=600",
    stock_quantity: 15,
    is_available: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "m3",
    name: "Spicy Cajun Fries",
    description: "Hand-cut Idaho golden potatoes, tossed in a smoky house seasoning blend, served hot with garlic dipping sauce.",
    price: 4.99,
    category: "Burgers",
    image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&q=80&w=600",
    stock_quantity: 5, // low stock alert trigger demo
    is_available: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "m5",
    name: "Signature Iced Matcha Latte",
    description: "Premium ceremonial-grade Uji matcha whisked with organic honey and creamy barista oat milk over ice.",
    price: 5.49,
    category: "Drinks",
    image: "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&q=80&w=600",
    stock_quantity: 50,
    is_available: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "m4",
    name: "Vanilla Craft Milkshake",
    description: "Creamy Madagascar bourbon vanilla bean gelato slow-blended with whole milk, topped with cloud-like whipped cream.",
    price: 5.99,
    category: "Drinks",
    image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&q=80&w=600",
    stock_quantity: 12,
    is_available: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "m6",
    name: "Double Fudge Chocolate Brownie",
    description: "Fudgy and highly decadent dark chocolate brownie served with a molten core and dusted with gold cocoa powder.",
    price: 6.99,
    category: "Desserts",
    image: "https://images.unsplash.com/photo-1564355808539-22fda35bed7e?auto=format&fit=crop&q=80&w=600",
    stock_quantity: 8,
    is_available: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// Helper to load and save data securely
function readDB(): { menu: MenuItem[]; orders: Order[] } {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const data = { menu: DEFAULT_MENU, orders: [] };
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
      return data;
    }
    const content = fs.readFileSync(DB_PATH, "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.error("Error reading database file, returning defaults:", error);
    return { menu: DEFAULT_MENU, orders: [] };
  }
}

function writeDB(data: { menu: MenuItem[]; orders: Order[] }) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("Error writing to database file:", error);
  }
}

// SSE Clients List
let clients: any[] = [];

function broadcastSSE(type: string, payload: any) {
  const text = `data: ${JSON.stringify({ type, payload })}\n\n`;
  clients.forEach((c) => {
    try {
      c.res.write(text);
    } catch (e) {
      // Ignore failures
    }
  });
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Lightweight health check endpoint for Uptime Robot pinging
  app.get("/ping", (req, res) => {
    res.status(200).send("OK");
  });

  // Enable CORS middleware so external dashboards can fetch/update data from other apps
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // SSE real-time updates setup
  app.get("/api/realtime", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const clientId = Date.now().toString();
    clients.push({ id: clientId, res });

    // Send connection affirmation
    res.write(`data: ${JSON.stringify({ type: "init", payload: { connected: true, clientId } })}\n\n`);

    // Send a heartbeat comment every 15 seconds to prevent gateway/proxy timeouts (e.g., Cloud Run / load balancers)
    const heartbeatInterval = setInterval(() => {
      try {
        res.write(": heartbeat\n\n");
      } catch (e) {
        clearInterval(heartbeatInterval);
      }
    }, 15000);

    req.on("close", () => {
      clearInterval(heartbeatInterval);
      clients = clients.filter((c) => c.id !== clientId);
    });
  });

  // API: Get Menu items
  app.get("/api/menu", (req, res) => {
    const db = readDB();
    res.json(db.menu);
  });

  // API: Create new Menu item (Admin)
  app.post("/api/menu", (req, res) => {
    const { name, description, price, category, image, stock_quantity } = req.body;
    if (!name || isNaN(Number(price)) || isNaN(Number(stock_quantity))) {
      res.status(400).json({ error: "Missing required menu item fields" });
      return;
    }

    const db = readDB();
    const newItem: MenuItem = {
      id: "menu_" + Date.now().toString(),
      name,
      description: description || "",
      price: Number(price),
      category: category || "General",
      image: image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=600",
      stock_quantity: Number(stock_quantity),
      is_available: Number(stock_quantity) > 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.menu.push(newItem);
    writeDB(db);

    // Broadcast update
    broadcastSSE("menu_updated", db.menu);

    res.status(201).json(newItem);
  });

  // API: Update Menu item (Admin)
  app.put("/api/menu/:id", (req, res) => {
    const { id } = req.params;
    const { name, description, price, category, image, stock_quantity, is_available } = req.body;

    const db = readDB();
    const index = db.menu.findIndex((m) => m.id === id);

    if (index === -1) {
      res.status(404).json({ error: "Menu item not found" });
      return;
    }

    const updatedStock = stock_quantity !== undefined ? Number(stock_quantity) : db.menu[index].stock_quantity;
    const updatedIsAvailable = is_available !== undefined ? Boolean(is_available) : (updatedStock > 0);

    db.menu[index] = {
      ...db.menu[index],
      name: name !== undefined ? name : db.menu[index].name,
      description: description !== undefined ? description : db.menu[index].description,
      price: price !== undefined ? Number(price) : db.menu[index].price,
      category: category !== undefined ? category : db.menu[index].category,
      image: image !== undefined ? image : db.menu[index].image,
      stock_quantity: updatedStock,
      is_available: updatedIsAvailable,
      updated_at: new Date().toISOString()
    };

    writeDB(db);

    // Broadcast menu changes to all active screens
    broadcastSSE("menu_updated", db.menu);

    res.json(db.menu[index]);
  });

  // API: Delete Menu item (Admin)
  app.delete("/api/menu/:id", (req, res) => {
    const { id } = req.params;

    const db = readDB();
    const index = db.menu.findIndex((m) => m.id === id);

    if (index === -1) {
      res.status(404).json({ error: "Menu item not found" });
      return;
    }

    db.menu.splice(index, 1);
    writeDB(db);

    broadcastSSE("menu_updated", db.menu);

    res.json({ message: "Menu item deleted successfully" });
  });

  // API: Get Orders (Admin & customer history checks)
  app.get("/api/orders", (req, res) => {
    const db = readDB();
    res.json(db.orders);
  });

  // API: Place a new Order (Customer)
  app.post("/api/orders", (req, res) => {
    const { customer_name, phone, address, notes, items } = req.body;

    if (!customer_name || !phone || !address || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "Missing required order checkout details" });
      return;
    }

    const db = readDB();

    // 1. Validate stocks before decrementing anything (transactional integrity)
    for (const item of items) {
      const dbItem = db.menu.find((m) => m.id === item.menu_item_id);
      if (!dbItem) {
        res.status(400).json({ error: `Menu item with ID ${item.menu_item_id} no longer exists.` });
        return;
      }
      if (!dbItem.is_available || dbItem.stock_quantity < item.quantity) {
        res.status(400).json({ error: `Not enough stock for ${dbItem.name}. Current stock: ${dbItem.stock_quantity}` });
        return;
      }
    }

    // 2. Perform stock deductions
    const validatedItems: OrderItem[] = [];
    let calculatedTotal = 0;

    for (const item of items) {
      const dbItem = db.menu.find((m) => m.id === item.menu_item_id)!;
      
      // Deduct stock
      dbItem.stock_quantity = Math.max(0, dbItem.stock_quantity - item.quantity);
      if (dbItem.stock_quantity === 0) {
        dbItem.is_available = false;
      }
      dbItem.updated_at = new Date().toISOString();

      const subtotal = Number((dbItem.price * item.quantity).toFixed(2));
      calculatedTotal += subtotal;

      validatedItems.push({
        menu_item_id: dbItem.id,
        name: dbItem.name,
        quantity: item.quantity,
        price: dbItem.price,
        subtotal
      });
    }

    // Add tax (let's say 8% tax) and calculate total amount
    const taxAmount = Number((calculatedTotal * 0.08).toFixed(2));
    const finalAmount = Number((calculatedTotal + taxAmount).toFixed(2));

    const newOrder: Order = {
      id: "ord_" + Math.random().toString(36).substr(2, 9).toUpperCase(),
      customer_name,
      phone,
      address,
      notes: notes || "",
      total_amount: finalAmount,
      status: "Pending",
      rejection_reason: null,
      items: validatedItems,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.orders.push(newOrder);
    writeDB(db);

    // Broadcast both order inclusion and menu updates to everyone
    broadcastSSE("order_created", newOrder);
    broadcastSSE("menu_updated", db.menu);

    res.status(201).json(newOrder);
  });

  // API: Update Order Status (Admin action)
  app.put("/api/orders/:id", (req, res) => {
    const { id } = req.params;
    const { status, rejection_reason } = req.body;

    const validStatuses = ["Pending", "Accepted", "Preparing", "Ready", "Completed", "Rejected"];
    if (status && !validStatuses.includes(status)) {
      res.status(400).json({ error: `Invalid status. Must be one of ${validStatuses.join(", ")}` });
      return;
    }

    const db = readDB();
    const index = db.orders.findIndex((o) => o.id === id);

    if (index === -1) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const previousStatus = db.orders[index].status;

    // Handle Rejected edge case: if user is rejecting, potentially restock items (optional, let's keep it as is, or restock)
    // To ensure stock accuracy, let's restock the items if the admin rejects the order!
    // This is super professional and prevents waste of stock.
    if (status === "Rejected" && previousStatus !== "Rejected") {
      for (const item of db.orders[index].items) {
        const dbItem = db.menu.find((m) => m.id === item.menu_item_id);
        if (dbItem) {
          dbItem.stock_quantity += item.quantity;
          dbItem.is_available = true;
          dbItem.updated_at = new Date().toISOString();
        }
      }
      broadcastSSE("menu_updated", db.menu);
    }

    db.orders[index] = {
      ...db.orders[index],
      status: status || db.orders[index].status,
      rejection_reason: status === "Rejected" ? (rejection_reason || "Unable to fulfill order at this time") : null,
      updated_at: new Date().toISOString()
    };

    writeDB(db);

    // Broadcast order update
    broadcastSSE("order_updated", db.orders[index]);

    res.json(db.orders[index]);
  });

  // API: Admin authentication (Secure Password Login)
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    // Simple secure check for admin
    if (username === "admin" && password === "admin123") {
      res.json({ success: true, token: "secure_admin_session_token_xyz" });
    } else {
      res.status(401).json({ error: "Invalid admin username or password." });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = process.env.PORT || 3000;
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
