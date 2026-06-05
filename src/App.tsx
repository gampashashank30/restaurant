import React, { useState, useEffect, useRef } from "react";
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Maximize2,
  Sliders,
  DollarSign,
  PlusCircle,
  LayoutDashboard,
  ClipboardList,
  Package,
  PlusSquare,
  Sparkles,
  Search,
  Filter,
  Eye,
  Info,
  LogOut,
  ChevronRight,
  ChevronLeft,
  X,
  SlidersHorizontal,
  FolderLock
} from "lucide-react";
import { MenuItem, Order, CartItem } from "./types";

export default function App() {
  // Navigation Routing System
  // Evaluates hash: '#/' (Menu), '#/cart', '#/checkout', '#/orders', '#/admin/*', etc.
  const [currentHash, setCurrentHash] = useState<string>(window.location.hash || "#/");
  
  // Real-time Database state
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingMenu, setLoadingMenu] = useState<boolean>(true);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(true);
  const [sseConnected, setSseConnected] = useState<boolean>(false);
  const [fallbackMode, setFallbackMode] = useState<boolean>(false);

  // Customer Cart & Active Tracking Orders state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>(" ");
  
  // Custom interactive search / filter query
  const [customerSearch, setCustomerSearch] = useState<string>("");

  // Customer Checkout Details state
  const [checkoutName, setCheckoutName] = useState<string>("");
  const [checkoutPhone, setCheckoutPhone] = useState<string>("");
  const [checkoutAddress, setCheckoutAddress] = useState<string>("");
  const [checkoutNotes, setCheckoutNotes] = useState<string>("");
  const [checkoutError, setCheckoutError] = useState<string>("");
  const [newlyCreatedOrderId, setNewlyCreatedOrderId] = useState<string | null>(null);

  // Admin Panel states
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem("admin_auth_token") === "secure_admin_session_token_xyz";
  });
  const [adminUsername, setAdminUsername] = useState<string>("");
  const [adminPassword, setAdminPassword] = useState<string>("");
  const [adminLoginError, setAdminLoginError] = useState<string>("");
  const [adminTab, setAdminTab] = useState<"dashboard" | "orders" | "inventory" | "menu" | "settings">("dashboard");

  // Admin Dialog states
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<Order | null>(null);
  const [rejectingOrder, setRejectingOrder] = useState<Order | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>("");
  const [isAddingMenuItem, setIsAddingMenuItem] = useState<boolean>(false);
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);

  // Form states for menu creation/edit
  const [menuFormName, setMenuFormName] = useState<string>("");
  const [menuFormDescription, setMenuFormDescription] = useState<string>("");
  const [menuFormPrice, setMenuFormPrice] = useState<string>("");
  const [menuFormCategory, setMenuFormCategory] = useState<string>("Pizzas");
  const [menuFormImage, setMenuFormImage] = useState<string>("");
  const [menuFormStock, setMenuFormStock] = useState<string>("");
  const [menuFormError, setMenuFormError] = useState<string>("");

  // Real-time Toast notification stream
  const [toasts, setToasts] = useState<{ id: string; text: string; type: "success" | "info" | "warning" }[]>([]);

  const addToast = (text: string, type: "success" | "info" | "warning" = "info") => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  // Sync route hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash || "#/";
      setCurrentHash(hash);
      
      // If navigating to admin panel, default tab layout
      if (hash.startsWith("#/admin")) {
        if (!isAdminAuthenticated) {
          // Keep on admin path but force auth
        }
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [isAdminAuthenticated]);

  // Load cart from localStorage on boot
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("restaurant_client_cart");
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
      const savedOrders = localStorage.getItem("restaurant_customer_order_ids");
      if (savedOrders) {
        const ids = JSON.parse(savedOrders) as string[];
        // Filter local state based on later fetching
      }
    } catch (e) {
      console.error("Failed loading local storage cache:", e);
    }
  }, []);

  // Save cart to localStorage automatically
  useEffect(() => {
    localStorage.setItem("restaurant_client_cart", JSON.stringify(cart));
  }, [cart]);

  // Fetch initial menu items and orders
  const fetchMenu = async () => {
    try {
      setLoadingMenu(true);
      const res = await fetch("/api/menu");
      if (res.ok) {
        const data = await res.json();
        setMenuItems(data);
      }
    } catch (error) {
      console.error("Failed to load menu list:", error);
    } finally {
      setLoadingMenu(false);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoadingOrders(true);
      const res = await fetch("/api/orders");
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
        
        // Match user's order statuses with localStorage saved order ids
        const localOrderIdsStr = localStorage.getItem("restaurant_customer_order_ids");
        if (localOrderIdsStr) {
          const localOrderIds = JSON.parse(localOrderIdsStr) as string[];
          const matching = data.filter((o: Order) => localOrderIds.includes(o.id));
          // Sort by date newest first
          matching.sort((a: Order, b: Order) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setCustomerOrders(matching);
        }
      }
    } catch (error) {
      console.error("Failed to load orders list:", error);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchMenu();
    fetchOrders();
  }, []);

  // Set up Server-Sent Events (SSE) Real-time subscription connection
  useEffect(() => {
    if (fallbackMode) {
      return;
    }

    let errorCount = 0;
    const eventSource = new EventSource("/api/realtime");

    eventSource.onopen = () => {
      setSseConnected(true);
      errorCount = 0;
    };

    eventSource.onerror = (e) => {
      setSseConnected(false);
      errorCount++;
      if (errorCount >= 3) {
        console.log("Establishing high-performance client backup engine to pull live updates...");
        setFallbackMode(true);
        eventSource.close();
      }
    };

    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "init") {
          console.log("Realtime gateway initialized securely:", message.payload);
        } else if (message.type === "menu_updated") {
          console.log("Real-time Menu Refresh:", message.payload);
          setMenuItems(message.payload);
          addToast("Menu availability updated in real-time", "info");
        } else if (message.type === "order_created") {
          const newOrder = message.payload as Order;
          setOrders((prev) => {
            if (prev.some((o) => o.id === newOrder.id)) return prev;
            return [newOrder, ...prev];
          });
          addToast(`💡 Alert: New order placed by ${newOrder.customer_name}!`, "success");
        } else if (message.type === "order_updated") {
          const updatedOrder = message.payload as Order;
          
          // Update global list
          setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
          
          // Live status feedback check for current customer
          const localOrderIdsStr = localStorage.getItem("restaurant_customer_order_ids");
          if (localOrderIdsStr) {
            const localOrderIds = JSON.parse(localOrderIdsStr) as string[];
            if (localOrderIds.includes(updatedOrder.id)) {
              setCustomerOrders((prev) => {
                const updatedList = prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o));
                if (!prev.some((o) => o.id === updatedOrder.id)) {
                  updatedList.unshift(updatedOrder);
                }
                return updatedList;
              });

              // Toast alert with style of modern dynamic progress
              addToast(`🍽️ Order ${updatedOrder.id} is now [${updatedOrder.status}]`, "success");
            }
          }
        }
      } catch (err) {
        console.error("Error parsing SSE incoming payload:", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [fallbackMode]);

  // Safe Fallback Polling when real-time SSE drops or is sandboxed by third-party iframe cookie/connection policies
  useEffect(() => {
    if (sseConnected) return;

    // Start a background interval to fetch orders and menu updates if SSE is offline
    const pollInterval = setInterval(() => {
      fetchOrders();
      fetchMenu();
    }, 5000); // Highly responsive 5-second interval

    return () => {
      clearInterval(pollInterval);
    };
  }, [sseConnected]);

  // Helper calculation constants
  const cartSubtotal = cart.reduce((acc, item) => acc + item.menuItem.price * item.quantity, 0);
  const cartTax = Number((cartSubtotal * 0.08).toFixed(2));
  const cartTotal = Number((cartSubtotal + cartTax).toFixed(2));

  // Add Item to Cart with local stock limits validation
  const addToCart = (item: MenuItem) => {
    if (!item.is_available || item.stock_quantity <= 0) {
      addToast(`Sorry, ${item.name} is currently out of stock.`, "warning");
      return;
    }

    const existingCartItem = cart.find((val) => val.menuItem.id === item.id);
    const currentQuantity = existingCartItem ? existingCartItem.quantity : 0;

    if (currentQuantity >= item.stock_quantity) {
      addToast(`Only ${item.stock_quantity} units of ${item.name} available in kitchen.`, "warning");
      return;
    }

    if (existingCartItem) {
      setCart(
        cart.map((val) =>
          val.menuItem.id === item.id ? { ...val, quantity: val.quantity + 1 } : val
        )
      );
    } else {
      setCart([...cart, { menuItem: item, quantity: 1 }]);
    }
    
    addToast(`Added ${item.name} to cart!`, "success");
  };

  // Modify Cart Item quantity with checks
  const updateCartQuantity = (id: string, amount: number) => {
    const item = cart.find((c) => c.menuItem.id === id);
    if (!item) return;

    const newQty = item.quantity + amount;
    if (newQty <= 0) {
      setCart(cart.filter((c) => c.menuItem.id !== id));
      addToast(`Removed ${item.menuItem.name} from basket`, "info");
      return;
    }

    // Check with available stock in database
    const dbItem = menuItems.find((m) => m.id === id);
    if (dbItem && newQty > dbItem.stock_quantity) {
      addToast(`We only have ${dbItem.stock_quantity} items in stock.`, "warning");
      return;
    }

    setCart(
      cart.map((c) => (c.menuItem.id === id ? { ...c, quantity: newQty } : c))
    );
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter((c) => c.menuItem.id !== id));
    addToast("Item removed from cart.", "info");
  };

  // Handle Order Placement checkout
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError("");

    if (!checkoutName.trim() || !checkoutPhone.trim() || !checkoutAddress.trim()) {
      setCheckoutError("Please provide your name, phone, and complete delivery address.");
      return;
    }

    if (cart.length === 0) {
      setCheckoutError("Your cart is empty. Please select food from the Menu first!");
      return;
    }

    const bodyData = {
      customer_name: checkoutName,
      phone: checkoutPhone,
      address: checkoutAddress,
      notes: checkoutNotes,
      items: cart.map((item) => ({
        menu_item_id: item.menuItem.id,
        quantity: item.quantity
      }))
    };

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData)
      });

      if (!res.ok) {
        const parser = await res.json();
        throw new Error(parser.error || "Failed placing the order.");
      }

      const orderData = await res.json() as Order;

      // Persist order identification in browser storage for customer tracking support
      const existingIdsRaw = localStorage.getItem("restaurant_customer_order_ids");
      const existingIds = existingIdsRaw ? JSON.parse(existingIdsRaw) : [];
      existingIds.push(orderData.id);
      localStorage.setItem("restaurant_customer_order_ids", JSON.stringify(existingIds));

      // Append to local state list
      setCustomerOrders([orderData, ...customerOrders]);
      
      // Clear checkout inputs and cart
      setCart([]);
      setCheckoutNotes("");
      setNewlyCreatedOrderId(orderData.id);
      
      addToast("☕ Receipt Generated! Order placed successfully.", "success");
      
      // Route immediately to live tracker screen
      window.location.hash = "#/orders";
    } catch (err: any) {
      setCheckoutError(err.message || "An unexpected error occurred during submission.");
    }
  };

  // Secure Admin Auth Sign-In
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoginError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: adminUsername, password: adminPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login rejected.");
      }

      localStorage.setItem("admin_auth_token", data.token);
      setIsAdminAuthenticated(true);
      addToast("Successfully logged in as Restaurant Manager", "success");
      window.location.hash = "#/admin/dashboard";
    } catch (error: any) {
      setAdminLoginError(error.message || "Authentication failed. Access Denied.");
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem("admin_auth_token");
    setIsAdminAuthenticated(false);
    addToast("Logged out of Admin Portal", "info");
    window.location.hash = "#/";
  };

  // Admin order actions updating state remotely
  const updateOrderStatus = async (orderId: string, status: string, reason: string | null = null) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, rejection_reason: reason })
      });

      if (!res.ok) {
        throw new Error("Unable to change order status on backend.");
      }

      const updatedOrder = await res.json() as Order;
      
      // Replace order in local listings
      setOrders(orders.map((o) => (o.id === orderId ? updatedOrder : o)));
      
      if (selectedOrderForModal && selectedOrderForModal.id === orderId) {
        setSelectedOrderForModal(updatedOrder);
      }

      addToast(`Order ${orderId} updated to ${status}!`, "success");
    } catch (err) {
      addToast("Could not modify state database.", "warning");
    }
  };

  // Save or Add Menu Item
  const handleMenuSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMenuFormError("");

    if (!menuFormName.trim() || !menuFormPrice.trim() || !menuFormStock.trim()) {
      setMenuFormError("Please fill out Name, Price, and Stock level!");
      return;
    }

    const priceNum = parseFloat(menuFormPrice);
    const stockNum = parseInt(menuFormStock, 10);

    if (isNaN(priceNum) || priceNum <= 0) {
      setMenuFormError("Please enter a valid positive decimal price.");
      return;
    }

    if (isNaN(stockNum) || stockNum < 0) {
      setMenuFormError("Please enter a valid stock quantity level.");
      return;
    }

    const payload = {
      name: menuFormName,
      description: menuFormDescription,
      price: priceNum,
      category: menuFormCategory,
      image: menuFormImage || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=600",
      stock_quantity: stockNum
    };

    try {
      let res;
      if (editingMenuItem) {
        // Edit existing path
        res = await fetch(`/api/menu/${editingMenuItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else {
        // Create path
        res = await fetch("/api/menu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Command execution aborted on the database.");
      }

      // Reset
      addToast(editingMenuItem ? "Menu item changed elegantly!" : "New menu signature crafted", "success");
      setIsAddingMenuItem(false);
      setEditingMenuItem(null);
      clearMenuForm();
      fetchMenu();
    } catch (e: any) {
      setMenuFormError(e.message || "Failed saving record.");
    }
  };

  // Re-stock fast modifier helper (Admin quick action button)
  const quickAlterStock = async (menuItem: MenuItem, increment: number) => {
    const nextStock = Math.max(0, menuItem.stock_quantity + increment);
    try {
      const res = await fetch(`/api/menu/${menuItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock_quantity: nextStock })
      });
      if (res.ok) {
        addToast(`Restocked ${menuItem.name} +${increment} units!`, "success");
        fetchMenu();
      }
    } catch (err) {
      addToast("Failed updating inventory stock", "warning");
    }
  };

  // Delete Menu Item from Catalog
  const deleteMenuItem = async (id: string) => {
    if (!window.confirm("Are you sure you want to completely remove this delicious recipe from the menu?")) {
      return;
    }

    try {
      const res = await fetch(`/api/menu/${id}`, { method: "DELETE" });
      if (res.ok) {
        addToast("Menu item permanently expunged.", "info");
        fetchMenu();
      } else {
        throw new Error();
      }
    } catch (e) {
      addToast("Could not remove catalog item", "warning");
    }
  };

  const openEditMenuItemModal = (item: MenuItem) => {
    setEditingMenuItem(item);
    setMenuFormName(item.name);
    setMenuFormDescription(item.description);
    setMenuFormPrice(item.price.toString());
    setMenuFormCategory(item.category);
    setMenuFormImage(item.image);
    setMenuFormStock(item.stock_quantity.toString());
    setIsAddingMenuItem(true);
  };

  const clearMenuForm = () => {
    setMenuFormName("");
    setMenuFormDescription("");
    setMenuFormPrice("");
    setMenuFormCategory("Pizzas");
    setMenuFormImage("");
    setMenuFormStock("");
    setMenuFormError("");
  };

  // Metrics evaluation for dashboard
  const lowStockThreshold = 5;
  const lowStockItems = menuItems.filter((i) => i.stock_quantity <= lowStockThreshold);
  const pendingOrders = orders.filter((o) => o.status === "Pending");
  
  const todayRevenue = orders
    .filter((o) => o.status !== "Rejected" && new Date(o.created_at).toDateString() === new Date().toDateString())
    .reduce((a, b) => a + b.total_amount, 0);

  const todayOrdersCount = orders.filter(
    (o) => new Date(o.created_at).toDateString() === new Date().toDateString()
  ).length;

  // Filter & Search computation on Menu
  const displayedMenuItems = menuItems.filter((item) => {
    const categoryMatches = selectedCategory === "All" || item.category === selectedCategory;
    const searchVal = customerSearch.trim().toLowerCase();
    const queryMatches =
      !searchVal ||
      item.name.toLowerCase().includes(searchVal) ||
      item.description.toLowerCase().includes(searchVal) ||
      item.category.toLowerCase().includes(searchVal);
    return categoryMatches && queryMatches;
  });

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-950 antialiased flex flex-col justify-between">
      
      {/* Dynamic Top bar with view portals toggle helper */}
      <div className="bg-slate-900 text-white text-xs px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md border-b border-slate-800 shrink-0 select-none z-50">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-ping"></div>
          <p className="font-semibold tracking-wide">
            Live Gourmet Workspace &bull; <span className="text-emerald-400 font-mono">Connected</span>
          </p>
        </div>

        {/* Global Client Side Navigation Switcher Panel */}
        <div className="flex items-center gap-1.5 bg-slate-800 p-0.5 rounded-lg border border-slate-700">
          <a
            href="#/"
            className={`px-3 py-1 rounded-md font-semibold transition-all ${
              !currentHash.startsWith("#/admin")
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Customer Front
          </a>
          <a
            href={isAdminAuthenticated ? "#/admin/dashboard" : "#/admin/login"}
            className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1 ${
              currentHash.startsWith("#/admin")
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <FolderLock className="w-3 h-3" /> Admin Portal
          </a>
        </div>
      </div>

      {/* Primary Workspace container */}
      <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col transition-all duration-300">
        
        {/* Toast stream rendering */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-md w-full px-4">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`p-4 rounded-xl shadow-lg border text-sm flex items-start gap-3 transform translate-y-0 transition-opacity justify-between ${
                toast.type === "success"
                  ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                  : toast.type === "warning"
                  ? "bg-amber-50 border-amber-100 text-amber-800"
                  : "bg-indigo-50 border-indigo-100 text-indigo-800"
              }`}
            >
              <div className="flex-1 font-medium">{toast.text}</div>
              <button
                onClick={() => setToasts(toasts.filter((t) => t.id !== toast.id))}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                &times;
              </button>
            </div>
          ))}
        </div>

        {/* CUSTOMER VIEWS SHIELD */}
        {!currentHash.startsWith("#/admin") && (
          <div className="flex flex-col flex-1">
            
            {/* Header Layout */}
            <header className="py-6 px-4 md:px-8 bg-white border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Artesian Crafted Eats</h1>
                  <p className="text-[11px] text-slate-500 font-medium tracking-wide uppercase">Organic, Fresh Counter Kitchen</p>
                </div>
              </div>

              {/* Navigation links for matching tabs */}
              <nav className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 text-sm">
                <a
                  href="#/"
                  className={`px-4 py-1.5 rounded-md font-semibold transition-all ${
                    currentHash === "#/" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Menu
                </a>
                <a
                  href="#/cart"
                  className={`px-4 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                    currentHash === "#/cart" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Cart
                  {cart.length > 0 && (
                    <span className="w-5 h-5 bg-indigo-600 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                      {cart.reduce((s, i) => s + i.quantity, 0)}
                    </span>
                  )}
                </a>
                <a
                  href="#/checkout"
                  className={`px-4 py-1.5 rounded-md font-semibold transition-all ${
                    currentHash === "#/checkout" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Checkout
                </a>
                <a
                  href="#/orders"
                  className={`px-4 py-1.5 rounded-md font-semibold transition-all flex items-center gap-2 ${
                    currentHash === "#/orders" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Tracking
                  {customerOrders.length > 0 && (
                    <span className="bg-slate-300 text-slate-800 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                      {customerOrders.filter((o) => o.status !== "Completed" && o.status !== "Rejected").length} Active
                    </span>
                  )}
                </a>
              </nav>
            </header>

            {/* Main view router area based on window.location.hash content */}
            <div className="flex-1 p-4 md:p-8">
              
              {/* 1. VIEW MENU CATALOG */}
              {currentHash === "#/" && (
                <div className="space-y-8 animate-fadeIn">
                  
                  {/* Category select + Search line */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                    
                    {/* Category List */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {["All", "Pizzas", "Burgers", "Drinks", "Desserts"].map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-wider ${
                            selectedCategory === cat
                              ? "bg-slate-950 text-white shadow-sm"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    {/* Search Field */}
                    <div className="relative w-full md:w-80">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search our delicious catalog..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-indigo-600 bg-slate-50 focus:bg-white transition-all text-slate-900 font-medium"
                      />
                      {customerSearch && (
                        <button
                          onClick={() => setCustomerSearch("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Food visual grids */}
                  {loadingMenu ? (
                    <div className="py-24 text-center space-y-3">
                      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                      <p className="text-slate-500 font-semibold text-sm">Brewing menu catalogue options...</p>
                    </div>
                  ) : displayedMenuItems.length === 0 ? (
                    <div className="bg-white rounded-3xl p-16 text-center border border-slate-200/80 shadow-sm max-w-lg mx-auto">
                      <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <h3 className="text-lg font-bold text-slate-930">No items matched your exploration</h3>
                      <p className="text-sm text-slate-500 mt-1">Try testing other keywords or changing categories.</p>
                      <button
                        onClick={() => { setSelectedCategory("All"); setCustomerSearch(""); }}
                        className="mt-5 bg-slate-950 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all uppercase tracking-wider hover:bg-indigo-600"
                      >
                        Reset Search Filters
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {displayedMenuItems.map((item) => {
                        const inBasket = cart.find((val) => val.menuItem.id === item.id);
                        const quantityInBasket = inBasket ? inBasket.quantity : 0;
                        const isLowStock = item.stock_quantity > 0 && item.stock_quantity <= 5;
                        const isOutOfStock = item.stock_quantity <= 0;

                        return (
                          <div
                            key={item.id}
                            className={`bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] hover:shadow-md relative ${
                              isOutOfStock ? "opacity-75" : ""
                            }`}
                          >
                            {/* Stock and Category Indicators */}
                            <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5 items-start">
                              <span className="bg-slate-900/85 text-white backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase">
                                {item.category}
                              </span>
                              
                              {/* Stock warnings dynamically rendered */}
                              {isOutOfStock ? (
                                <span className="bg-red-600 text-white px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide shadow-md">
                                  Out of Stock
                                </span>
                              ) : isLowStock ? (
                                <span className="bg-amber-500 text-slate-950 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide shadow-md flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> Low Stock: {item.stock_quantity} Left
                                </span>
                              ) : (
                                <span className="bg-slate-100/90 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-full text-[10px] font-bold">
                                  Stock: {item.stock_quantity}
                                </span>
                              )}
                            </div>

                            {/* Food Card Image */}
                            <div className="h-48 relative overflow-hidden bg-slate-100 shrink-0">
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-full h-full object-cover select-none"
                                loading="lazy"
                              />
                              {quantityInBasket > 0 && (
                                <div className="absolute top-4 right-4 bg-indigo-600 text-white w-9 h-9 rounded-full flex items-center justify-center font-bold shadow-lg text-sm border-2 border-white animate-pulse">
                                  {quantityInBasket}
                                </div>
                              )}
                            </div>

                            {/* Info Section */}
                            <div className="p-6 flex-1 flex flex-col justify-between">
                              <div className="space-y-2">
                                <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                                  {item.name}
                                </h3>
                                <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">
                                  {item.description || "Freshly baked artisan product sourced through dynamic premium ingredients."}
                                </p>
                              </div>

                              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                                <div className="flex flex-col">
                                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Price</span>
                                  <span className="text-lg font-extrabold text-indigo-600">${item.price.toFixed(2)}</span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => addToCart(item)}
                                  disabled={isOutOfStock}
                                  className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all uppercase tracking-wider ${
                                    isOutOfStock
                                      ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                                      : "bg-slate-950 text-white hover:bg-indigo-600 shadow-sm cursor-pointer"
                                  }`}
                                >
                                  {isOutOfStock ? "Unavailable" : "Add to Cart"}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 2. CHOSEN BASKET (CART) */}
              {currentHash === "#/cart" && (
                <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900">Your Basket Collection</h2>
                      <p className="text-sm text-slate-500 mt-1">Review your selected organic gastronomy treats before placing the order.</p>
                    </div>
                    
                    {cart.length > 0 && (
                      <button
                        onClick={() => { setCart([]); addToast("Basket cleared", "info"); }}
                        className="text-red-500 hover:text-red-700 text-xs font-bold uppercase tracking-wider flex items-center gap-1 hover:underline"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Empty Cart
                      </button>
                    )}
                  </div>

                  {cart.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center shadow-sm">
                      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <ShoppingBag className="w-8 h-8 text-slate-300" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900">Your basket is feeling light</h3>
                      <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
                        Explore our freshly baked sourdough pizzas, double smash beef burgers, craft milkshakes and more!
                      </p>
                      <a
                        href="#/"
                        className="mt-6 inline-block bg-slate-950 text-white px-6 py-3 rounded-xl text-xs font-bold transition-all uppercase tracking-wider hover:bg-indigo-600"
                      >
                        Back to Menu Catalog
                      </a>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                      
                      {/* Products List */}
                      <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-6">
                        <div className="divide-y divide-slate-100">
                          {cart.map((item) => (
                            <div key={item.menuItem.id} className="py-4 first:pt-0 last:pb-0 flex items-center gap-4">
                              <img
                                src={item.menuItem.image}
                                alt={item.menuItem.name}
                                className="w-16 h-16 rounded-xl object-cover bg-slate-100 shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-slate-900 truncate">
                                  {item.menuItem.name}
                                </h4>
                                <p className="text-xs text-indigo-600 font-bold mt-0.5">
                                  ${item.menuItem.price.toFixed(2)} each
                                </p>
                              </div>
                              
                              {/* Quantity Adjustment Selector */}
                              <div className="flex items-center gap-2 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200">
                                <button
                                  onClick={() => updateCartQuantity(item.menuItem.id, -1)}
                                  className="text-slate-500 hover:text-slate-800 transition"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="font-mono text-xs font-bold w-6 text-center text-slate-900">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => updateCartQuantity(item.menuItem.id, 1)}
                                  className="text-slate-500 hover:text-slate-800 transition"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <button
                                onClick={() => removeFromCart(item.menuItem.id)}
                                className="text-slate-300 hover:text-red-500 p-1.5 transition"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Summary Pricing column */}
                      <div className="lg:col-span-5 bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800 space-y-6">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Checkout Bill Invoice</h3>
                        
                        <div className="space-y-3 pt-2 text-sm border-b border-slate-800 pb-5">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Basket Subtotal</span>
                            <span className="font-mono">${cartSubtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">State Food Tax (8.0%)</span>
                            <span className="font-mono">${cartTax}</span>
                          </div>
                          <div className="flex justify-between text-emerald-400 font-bold">
                            <span>Delivery Partner Fee</span>
                            <span className="uppercase text-xs tracking-wider">Free Delivery</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-baseline pt-2">
                          <span className="text-sm font-bold text-slate-400">Grand Total</span>
                          <span className="text-2xl font-black text-white font-mono">${cartTotal}</span>
                        </div>

                        <div className="pt-2">
                          <a
                            href="#/checkout"
                            className="block w-full text-center bg-indigo-600 text-white py-3 rounded-xl text-xs font-bold transition-all uppercase tracking-widest hover:bg-emerald-600 hover:shadow-md shadow-indigo-500/20"
                          >
                            Proceed to Secure Shipment
                          </a>
                          <a
                            href="#/"
                            className="block text-center text-slate-400 hover:text-white text-[11px] mt-4 font-bold uppercase tracking-wider transition underline"
                          >
                            Add More Items
                          </a>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              )}

              {/* 3. CUSTOMER CHECKOUT */}
              {currentHash === "#/checkout" && (
                <div className="max-w-xl mx-auto animate-fadeIn">
                  <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                    <div className="p-6 md:p-8 bg-slate-900 text-white border-b border-slate-800">
                      <h2 className="text-xl font-bold">Delivery Location & Information</h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Our dynamic kitchen starts preparation instantly upon checking out.
                      </p>
                    </div>

                    <form onSubmit={handleCheckoutSubmit} className="p-6 md:p-8 space-y-6">
                      
                      {checkoutError && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-semibold flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0" /> {checkoutError}
                        </div>
                      )}

                      {cart.length === 0 ? (
                        <div className="text-center py-6">
                          <p className="text-slate-500 text-sm">Your basket is empty, please select food first.</p>
                          <a
                            href="#/"
                            className="mt-4 inline-block bg-slate-950 text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider"
                          >
                            Browse Menu
                          </a>
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Customer Full Name *</label>
                            <input
                              type="text"
                              value={checkoutName}
                              onChange={(e) => setCheckoutName(e.target.value)}
                              placeholder="Sarah Jenkins"
                              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-indigo-600"
                              required
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Phone Number *</label>
                              <input
                                type="tel"
                                value={checkoutPhone}
                                onChange={(e) => setCheckoutPhone(e.target.value)}
                                placeholder="+1 (555) 234-9021"
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-indigo-600"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Total Due Bill</label>
                              <input
                                type="text"
                                readOnly
                                value={`$${cartTotal}`}
                                className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 select-none cursor-not-allowed"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Complete Delivery Address *</label>
                            <textarea
                              value={checkoutAddress}
                              onChange={(e) => setCheckoutAddress(e.target.value)}
                              placeholder="Apartment, building number, street name, state area postal"
                              rows={3}
                              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-indigo-600 resize-none"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Kitchen Delivery Notes (Optional)</label>
                            <input
                              type="text"
                              value={checkoutNotes}
                              onChange={(e) => setCheckoutNotes(e.target.value)}
                              placeholder="e.g. Leave on the porch, ring bell, allergy details..."
                              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-indigo-600 animate-pulse-slow"
                            />
                          </div>

                          <div className="pt-4 border-t border-slate-100">
                            <button
                              type="submit"
                              className="w-full bg-slate-950 text-white font-bold py-3.5 px-6 rounded-xl text-xs uppercase tracking-widest tracking-wide hover:bg-indigo-600 shadow-md flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5" /> Place Order (Pay Cash on Delivery)
                            </button>
                            <p className="text-[10px] text-center text-slate-400 mt-2.5">
                              By placing, you authorize real-time food processing status checks instantly.
                            </p>
                          </div>
                        </>
                      )}

                    </form>
                  </div>
                </div>
              )}

              {/* 4. REAL-TIME CUSTOMER ORDER TRACKER */}
              {currentHash === "#/orders" && (
                <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <Clock className="w-6 h-6 text-indigo-600" /> Active Order Tracker
                      </h2>
                      <p className="text-sm text-slate-500 mt-1">Live synchronized receipt delivery dashboard updating in real-time.</p>
                    </div>

                    <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shrink-0 animate-pulse">
                      <div className="w-2 h-2 bg-indigo-600 rounded-full"></div> Real-time Gateway Active
                    </div>
                  </div>

                  {customerOrders.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-slate-200/80 p-16 text-center max-w-lg mx-auto">
                      <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4 animate-bounce" />
                      <h3 className="text-base font-bold text-slate-900">No Orders Tracked in this Browser</h3>
                      <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
                        Once you choose items and checkout, you will see their preparation progression tracker live here!
                      </p>
                      <a
                        href="#/"
                        className="mt-6 inline-block bg-slate-950 text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-indigo-600"
                      >
                        Explore Menu Catalog
                      </a>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {customerOrders.map((ord) => {
                        const isPending = ord.status === "Pending";
                        const isAccepted = ord.status === "Accepted";
                        const isPreparing = ord.status === "Preparing";
                        const isReady = ord.status === "Ready";
                        const isCompleted = ord.status === "Completed";
                        const isRejected = ord.status === "Rejected";

                        // Order tracker progress percentage calculation
                        let percent = 10;
                        if (isAccepted) percent = 30;
                        if (isPreparing) percent = 60;
                        if (isReady) percent = 85;
                        if (isCompleted) percent = 100;
                        if (isRejected) percent = 100;

                        return (
                          <div
                            key={ord.id}
                            className={`bg-white rounded-3xl border shadow-sm overflow-hidden flex flex-col justify-between transition-all ${
                              isRejected ? "border-red-200" : isCompleted ? "border-emerald-200" : "border-slate-200/80"
                            }`}
                          >
                            {/* Tracker Header */}
                            <div className="p-6 md:px-8 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="space-y-1">
                                <span className="font-mono text-slate-400 text-xs font-bold">{ord.id}</span>
                                <h3 className="text-base font-extrabold text-white">For: {ord.customer_name}</h3>
                                <p className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase">
                                  Placed: {new Date(ord.created_at).toLocaleTimeString() || "Just now"}
                                </p>
                              </div>

                              <div className="text-right">
                                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Estimated Total</span>
                                <span className="text-2xl font-black text-white font-mono">${ord.total_amount.toFixed(2)}</span>
                              </div>
                            </div>

                            {/* Tracking Journey Component */}
                            <div className="p-6 md:px-8 border-b border-slate-100 flex-1">
                              
                              {/* Rejection Alert Header */}
                              {isRejected && (
                                <div className="mb-6 bg-red-50 border border-red-100 rounded-2xl p-4 text-red-800 text-sm">
                                  <div className="flex items-center gap-2 font-bold mb-1">
                                    <XCircle className="w-5 h-5 text-red-600" /> Order Rejected By Kitchen
                                  </div>
                                  <p className="text-slate-600 text-xs pl-7">
                                    Reason provided: <span className="text-red-900 font-mono font-medium">{ord.rejection_reason}</span>
                                  </p>
                                </div>
                              )}

                              {/* Progress bar */}
                              <div className="relative mb-8 pt-4">
                                <div className="h-2 bg-slate-100 rounded-full w-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-1000 ${
                                      isRejected ? "bg-red-500" : isCompleted ? "bg-emerald-500 font-medium" : "bg-indigo-600"
                                    }`}
                                    style={{ width: `${percent}%` }}
                                  ></div>
                                </div>
                                
                                {/* Steps markers */}
                                <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-between px-1 pointer-events-none">
                                  <div className={`w-6 h-6 rounded-full border-4 border-white ${isPending ? "bg-indigo-600 shadow" : "bg-slate-200"}`} />
                                  <div className={`w-6 h-6 rounded-full border-4 border-white ${isAccepted ? "bg-indigo-600 shadow" : isPreparing || isReady || isCompleted ? "bg-emerald-500" : "bg-slate-200"}`} />
                                  <div className={`w-6 h-6 rounded-full border-4 border-white ${isPreparing ? "bg-indigo-600 shadow" : isReady || isCompleted ? "bg-emerald-500" : "bg-slate-200"}`} />
                                  <div className={`w-6 h-6 rounded-full border-4 border-white ${isReady ? "bg-indigo-600 shadow" : isCompleted ? "bg-emerald-500" : "bg-slate-200"}`} />
                                  <div className={`w-6 h-6 rounded-full border-4 border-white ${isCompleted ? "bg-emerald-500 shadow" : "bg-slate-200"}`} />
                                </div>
                              </div>

                              {/* Tracking Status labels */}
                              <div className="grid grid-cols-5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider gap-1">
                                <div className={isPending ? "text-indigo-600 font-black scale-105" : ""}>Pending</div>
                                <div className={isAccepted ? "text-indigo-600 font-black scale-105" : isPreparing || isReady || isCompleted ? "text-slate-800" : ""}>Accepted</div>
                                <div className={isPreparing ? "text-indigo-600 font-black scale-105" : isReady || isCompleted ? "text-slate-800" : ""}>Preparing</div>
                                <div className={isReady ? "text-indigo-600 font-black scale-105" : isCompleted ? "text-slate-800" : ""}>Ready</div>
                                <div className={isCompleted ? "text-emerald-600 font-black scale-105" : ""}>Completed</div>
                              </div>

                              {/* Delivery Information Accordion */}
                              <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                                <div className="space-y-3">
                                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Shipped Location</h4>
                                  <div className="space-y-1">
                                    <p className="font-semibold text-slate-800">{ord.customer_name}</p>
                                    <p className="text-slate-500 text-xs">{ord.phone}</p>
                                    <p className="text-slate-500 text-xs leading-relaxed">{ord.address}</p>
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 font-sans">Recipe Items ordered</h4>
                                  <div className="divide-y divide-slate-100">
                                    {ord.items.map((it, idx) => (
                                      <div key={idx} className="py-2 first:pt-0 last:pb-0 flex justify-between text-xs">
                                        <span className="text-slate-600">
                                          <span className="font-mono font-bold text-slate-900 border border-slate-200 px-1.5 py-0.5 rounded bg-slate-50 mr-1.5">{it.quantity}x</span> 
                                          {it.name}
                                        </span>
                                        <span className="font-mono font-semibold text-slate-800">${it.subtotal.toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {ord.notes && (
                                <div className="mt-4 p-3 bg-slate-50 text-slate-500 rounded-xl leading-relaxed text-xs border border-slate-100">
                                  <span className="font-bold text-slate-800">Dispatch Notes:</span> {ord.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        )}

        {/* ADMIN PORTAL PANEL SHIELD */}
        {currentHash.startsWith("#/admin") && (
          <div className="flex flex-col flex-1">
            
            {/* Login Shield if NOT Authenticated */}
            {!isAdminAuthenticated ? (
              <div className="max-w-md mx-auto my-12 md:my-24 p-6 md:p-8 bg-white rounded-3xl border border-slate-200 shadow-xl w-full">
                <div className="text-center space-y-2 mb-8">
                  <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center mx-auto shadow">
                    <FolderLock className="w-6 h-6 text-indigo-500 animate-pulse-slow" />
                  </div>
                  <h2 className="text-xl font-black text-slate-900">Sign in to Administration</h2>
                  <p className="text-xs text-slate-500">Authorize manager roles to accept orders and manage stocks.</p>
                </div>

                <form onSubmit={handleAdminLogin} className="space-y-5">
                  {adminLoginError && (
                    <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-semibold">
                      {adminLoginError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Username</label>
                    <input
                      type="text"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      placeholder="admin"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-indigo-600"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Password</label>
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-indigo-600"
                      required
                    />
                    <p className="text-[10px] text-slate-500 mt-1.5 font-medium select-none">
                      🔒 Authorization required. Entry monitored.
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-slate-950 text-white font-bold py-3 px-6 rounded-xl text-xs uppercase tracking-widest hover:bg-indigo-600 transition shadow-md cursor-pointer"
                  >
                    Authenticate
                  </button>
                </form>
              </div>
            ) : (
              // Authenticated Admin Dashboard Layout
              <div className="flex flex-col md:flex-row flex-1 min-h-[500px]">
                
                {/* Lateral Navigation Sidebar */}
                <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200 p-6 flex flex-col justify-between shrink-0">
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 pb-5 border-b border-slate-100">
                      <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-white shadow-md">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <span className="font-black text-slate-900 tracking-tight text-md">Artisan<span className="text-indigo-600">HQ</span></span>
                    </div>

                    <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Management Portal</p>
                    
                    <nav className="space-y-1.5">
                      <button
                        onClick={() => setAdminTab("dashboard")}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide uppercase transition-all ${
                          adminTab === "dashboard"
                            ? "bg-slate-950 text-white shadow-sm"
                            : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                      >
                        <LayoutDashboard className="w-4 h-4 shrink-0" />
                        Dashboard
                      </button>

                      <button
                        onClick={() => setAdminTab("orders")}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide uppercase transition-all justify-between ${
                          adminTab === "orders"
                            ? "bg-slate-950 text-white shadow-sm"
                            : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <ClipboardList className="w-4 h-4 shrink-0" />
                          Orders
                        </div>
                        {pendingOrders.length > 0 && (
                          <span className="bg-orange-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-extrabold animate-bounce">
                            {pendingOrders.length}
                          </span>
                        )}
                      </button>

                      <button
                        onClick={() => setAdminTab("inventory")}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide uppercase transition-all justify-between ${
                          adminTab === "inventory"
                            ? "bg-slate-950 text-white shadow-sm"
                            : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Package className="w-4 h-4 shrink-0" />
                          Inventory
                        </div>
                        {lowStockItems.length > 0 && (
                          <span className="bg-amber-500 text-slate-950 text-[9px] px-2 py-0.5 rounded-full font-black">
                            {lowStockItems.length} Low
                          </span>
                        )}
                      </button>

                      <button
                        onClick={() => setAdminTab("menu")}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide uppercase transition-all ${
                          adminTab === "menu"
                            ? "bg-slate-950 text-white shadow-sm"
                            : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                      >
                        <PlusSquare className="w-4 h-4 shrink-0" />
                        Menu setup
                      </button>

                      <button
                        onClick={() => setAdminTab("settings")}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide uppercase transition-all ${
                          adminTab === "settings"
                            ? "bg-slate-950 text-white shadow-sm"
                            : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                      >
                        <Sliders className="w-4 h-4 shrink-0" />
                        Settings
                      </button>
                    </nav>
                  </div>

                  <div className="pt-6 border-t border-slate-100 space-y-4">
                    <div className="flex items-center gap-2.5 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                      <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs select-none">
                        M
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">Manager Room</p>
                        <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Lead Chef</p>
                      </div>
                    </div>

                    <button
                      onClick={handleAdminLogout}
                      className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 transition rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Sign-out
                    </button>
                  </div>
                </aside>

                {/* Lateral view container */}
                <main className="flex-1 p-6 md:p-8 space-y-8 min-w-0 bg-slate-50">
                  
                  {/* ADMIN HEADER */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-200">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 leading-none">
                        {adminTab === "dashboard" && "Performance Insights"}
                        {adminTab === "orders" && "Fulfillment Queues"}
                        {adminTab === "inventory" && "Raw Ingredient Stocks"}
                        {adminTab === "menu" && "Gourmet Menu Blueprint"}
                        {adminTab === "settings" && "General Service Setup"}
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        {adminTab === "dashboard" && "Aggregate overview of revenue, pending requests, and low stocks."}
                        {adminTab === "orders" && "Accept or reject orders, and cycle preparation stages dynamically."}
                        {adminTab === "inventory" && "Update raw stocks, review out of stock notices, and manage triggers."}
                        {adminTab === "menu" && "Modify, delete, or create signature culinary recipes catalogued."}
                        {adminTab === "settings" && "Configure quick variables, simulator inputs, and bypass modes."}
                      </p>
                    </div>

                    {adminTab === "menu" && (
                      <button
                        onClick={() => { clearMenuForm(); setIsAddingMenuItem(true); }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider shadow-sm flex items-center gap-1 cursor-pointer"
                      >
                        <PlusCircle className="w-4 h-4" /> Add Culinary Item
                      </button>
                    )}
                  </div>

                  {/* ADMIN TABS ROUTER */}
                  
                  {/* TAB 1: DASHBOARD METRICS */}
                  {adminTab === "dashboard" && (
                    <div className="space-y-8 animate-fadeIn">
                      
                      {/* Metric widgets */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-28">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Revenue Today</span>
                          <span className="text-2xl font-black text-slate-900 font-mono">${todayRevenue.toFixed(2)}</span>
                          <span className="text-[9px] text-emerald-600 font-bold uppercase">Cash on delivery payments</span>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-28">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">Active Live Orders</span>
                          <span className="text-2xl font-black text-indigo-600 font-mono">{orders.filter((o) => o.status !== "Completed" && o.status !== "Rejected").length}</span>
                          <span className="text-[9px] text-slate-400 font-medium">Currently on journey progression</span>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-28">
                          <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest font-bold">Unattended Pending</span>
                          <span className="text-2xl font-black text-orange-600 font-mono">{pendingOrders.length}</span>
                          <span className="text-[9px] text-orange-500 font-black animate-pulse uppercase">Approval required</span>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-28">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Low Stock Alarms</span>
                          <span className="text-2xl font-black text-red-500 font-mono">{lowStockItems.length}</span>
                          <span className="text-[9px] text-red-500 font-black uppercase">Requires raw restocking</span>
                        </div>
                      </div>

                      {/* Low Stock Alerts Notification Panel */}
                      {lowStockItems.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 space-y-4">
                          <div className="flex items-center gap-2 text-amber-900 font-black text-sm">
                            <AlertTriangle className="w-5 h-5 text-amber-500" /> Kitchen Inventory Warning Alarms
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {lowStockItems.map((item) => (
                              <div
                                key={item.id}
                                className="bg-white p-4 rounded-2xl border border-amber-100 flex justify-between items-center shadow-sm"
                              >
                                <div>
                                  <p className="font-bold text-slate-900 text-sm leading-tight">{item.name}</p>
                                  <p className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5 mt-1">
                                    Current Raw Stock: <span className="font-mono text-red-600 font-bold">{item.stock_quantity}</span>
                                  </p>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => quickAlterStock(item, 10)}
                                    className="bg-slate-950 text-white text-[10px] uppercase tracking-wider font-bold px-3 py-1.5 rounded-xl hover:bg-indigo-600 transition"
                                  >
                                    Restock +10
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recent Orders Overview layout table */}
                      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                          <h3 className="font-black text-slate-900 text-sm tracking-wide uppercase">Recent Ordering Journal</h3>
                          <button
                            onClick={() => setAdminTab("orders")}
                            className="text-xs text-indigo-600 font-bold hover:underline"
                          >
                            Go to Queue Dashboard &rarr;
                          </button>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                              <tr>
                                <th className="p-4 pl-6">Order ID</th>
                                <th className="p-4">Customer Name</th>
                                <th className="p-4">Items Placed</th>
                                <th className="p-4">Amount</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Created</th>
                                <th className="p-4 pr-6 text-right">Fulfillment Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                              {orders.length === 0 ? (
                                <tr>
                                  <td colSpan={7} className="p-8 text-center text-slate-400">
                                    No incoming customer requests placed today yet.
                                  </td>
                                </tr>
                              ) : (
                                orders.slice(0, 5).map((ord) => (
                                  <tr key={ord.id} className="hover:bg-slate-50">
                                    <td className="p-4 pl-6 font-mono font-bold text-slate-400">{ord.id}</td>
                                    <td className="p-4 font-bold text-slate-900">{ord.customer_name}</td>
                                    <td className="p-4 text-slate-500 max-w-xs truncate">
                                      {ord.items.map((it) => `${it.quantity}x ${it.name}`).join(", ")}
                                    </td>
                                    <td className="p-4 font-bold text-slate-900 font-mono">${ord.total_amount.toFixed(2)}</td>
                                    <td className="p-4">
                                      <span
                                        className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider ${
                                          ord.status === "Pending"
                                            ? "bg-orange-100 text-orange-700"
                                            : ord.status === "Accepted"
                                            ? "bg-slate-150 text-slate-800"
                                            : ord.status === "Preparing"
                                            ? "bg-blue-100 text-blue-700 animate-pulse"
                                            : ord.status === "Ready"
                                            ? "bg-indigo-100 text-indigo-700"
                                            : ord.status === "Completed"
                                            ? "bg-emerald-100 text-emerald-700"
                                            : "bg-red-100 text-red-700"
                                        }`}
                                      >
                                        {ord.status}
                                      </span>
                                    </td>
                                    <td className="p-4 text-[10px] text-slate-400">
                                      {new Date(ord.created_at).toLocaleTimeString()}
                                    </td>
                                    <td className="p-4 pr-6 text-right space-x-1.5">
                                      {ord.status === "Pending" && (
                                        <>
                                          <button
                                            onClick={() => updateOrderStatus(ord.id, "Accepted")}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded text-[9px] uppercase tracking-wider"
                                          >
                                            Accept
                                          </button>
                                          <button
                                            onClick={() => { setRejectingOrder(ord); setRejectionReasonInput(""); }}
                                            className="bg-red-50 hover:bg-red-100 text-red-600 font-bold px-2.5 py-1 rounded text-[9px] uppercase tracking-wider border border-red-200"
                                          >
                                            Reject
                                          </button>
                                        </>
                                      )}
                                      
                                      {ord.status === "Accepted" && (
                                        <button
                                          onClick={() => updateOrderStatus(ord.id, "Preparing")}
                                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1 rounded text-[9px] uppercase"
                                        >
                                          Prepare
                                        </button>
                                      )}

                                      {ord.status === "Preparing" && (
                                        <button
                                          onClick={() => updateOrderStatus(ord.id, "Ready")}
                                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2.5 py-1 rounded text-[9px] uppercase"
                                        >
                                          Ready
                                        </button>
                                      )}

                                      {ord.status === "Ready" && (
                                        <button
                                          onClick={() => updateOrderStatus(ord.id, "Completed")}
                                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded text-[9px] uppercase"
                                        >
                                          Complete
                                        </button>
                                      )}

                                      <button
                                        onClick={() => setSelectedOrderForModal(ord)}
                                        className="text-slate-500 hover:text-slate-800 text-[10px] font-bold underline cursor-pointer"
                                      >
                                        View
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* TAB 2: FULL ORDERS MANAGEMENT LIST */}
                  {adminTab === "orders" && (
                    <div className="space-y-6 animate-fadeIn">
                      
                      {orders.length === 0 ? (
                        <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 max-w-sm mx-auto">
                          <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                          <h3 className="font-bold text-slate-900">Queue is Clear</h3>
                          <p className="text-xs text-slate-500 mt-1">Pending order cards will pop up here in real-time.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {orders.map((ord) => (
                            <div
                              key={ord.id}
                              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 hover:border-slate-300 transition-all flex flex-col justify-between"
                            >
                              <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-xs font-bold text-slate-400">{ord.id}</span>
                                    <span
                                      className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-wider ${
                                        ord.status === "Pending"
                                          ? "bg-orange-100 text-orange-700"
                                          : ord.status === "Accepted"
                                          ? "bg-slate-100 text-slate-800"
                                          : ord.status === "Preparing"
                                          ? "bg-blue-100 text-blue-700"
                                          : ord.status === "Ready"
                                          ? "bg-indigo-100 text-indigo-750"
                                          : ord.status === "Completed"
                                          ? "bg-emerald-100 text-emerald-705 font-medium"
                                          : "bg-red-100 text-red-700"
                                      }`}
                                    >
                                      {ord.status}
                                    </span>
                                  </div>
                                  <h3 className="text-sm font-bold text-slate-900 mt-1.5">For: {ord.customer_name} ({ord.phone})</h3>
                                  <p className="text-slate-500 text-xs mt-0.5">{ord.address}</p>
                                </div>

                                <div className="text-left sm:text-right">
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Total amount</p>
                                  <p className="text-base font-black text-slate-950 font-mono">${ord.total_amount.toFixed(2)}</p>
                                </div>
                              </div>

                              <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-100 flex-1">
                                <p className="text-[10px] text-slate-400 font-bold uppercase">Ordered Recipes ({ord.items.length})</p>
                                <div className="divide-y divide-slate-100">
                                  {ord.items.map((it, i) => (
                                    <div key={i} className="py-1 flex justify-between text-xs">
                                      <span className="text-slate-700 font-medium">
                                        <span className="font-mono font-bold text-slate-900 border border-slate-100 rounded px-1.5 py-0.2 bg-white mr-1.5">{it.quantity}x</span>
                                        {it.name}
                                      </span>
                                      <span className="font-mono text-slate-500">${it.subtotal.toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {ord.notes && (
                                <p className="text-xs text-slate-500 leading-normal pl-1.5 border-l-2 border-indigo-500/50">
                                  <span className="font-semibold text-slate-800">Dispatch Notes:</span> {ord.notes}
                                </p>
                              )}

                              {ord.rejection_reason && (
                                <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg font-mono font-medium">
                                  Rejection Reason: {ord.rejection_reason}
                                </p>
                              )}

                              <div className="pt-4 border-t border-slate-100/80 flex flex-wrap justify-between items-center gap-2">
                                <div className="text-[10px] text-slate-400">
                                  Created {new Date(ord.created_at).toLocaleString()}
                                </div>

                                <div className="flex gap-2">
                                  {ord.status === "Pending" && (
                                    <>
                                      <button
                                        onClick={() => updateOrderStatus(ord.id, "Accepted")}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-[10px] uppercase cursor-pointer"
                                      >
                                        Accept Order
                                      </button>
                                      <button
                                        onClick={() => { setRejectingOrder(ord); setRejectionReasonInput(""); }}
                                        className="bg-red-55 border border-red-200 text-red-650 hover:bg-red-105 px-3 py-1.5 rounded-xl text-[10px] uppercase cursor-pointer"
                                      >
                                        Reject Order
                                      </button>
                                    </>
                                  )}

                                  {ord.status === "Accepted" && (
                                    <button
                                      onClick={() => updateOrderStatus(ord.id, "Preparing")}
                                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 py-1.5 rounded-xl text-[10px] uppercase cursor-pointer"
                                    >
                                      Mark Preparing
                                    </button>
                                  )}

                                  {ord.status === "Preparing" && (
                                    <button
                                      onClick={() => updateOrderStatus(ord.id, "Ready")}
                                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-1.5 rounded-xl text-[10px] uppercase cursor-pointer"
                                    >
                                      Mark Food Ready
                                    </button>
                                  )}

                                  {ord.status === "Ready" && (
                                    <button
                                      onClick={() => updateOrderStatus(ord.id, "Completed")}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-1.5 rounded-xl text-[10px] uppercase cursor-pointer"
                                    >
                                      Complete Order
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                    </div>
                  )}

                  {/* TAB 3: PHYSICAL QUANTITY INVENTORY MANAGEMENT */}
                  {adminTab === "inventory" && (
                    <div className="space-y-6 animate-fadeIn">
                      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                        
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                              <tr>
                                <th className="p-4 pl-6">Picture</th>
                                <th className="p-4">Menu Recipe Name</th>
                                <th className="p-4">Category</th>
                                <th className="p-4 font-mono">Current Quantity</th>
                                <th className="p-4">Availability</th>
                                <th className="p-4 pr-6 text-right">Raw Alter Stock levels</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                              {menuItems.map((item) => {
                                const isLowStock = item.stock_quantity > 0 && item.stock_quantity <= 5;
                                const isOutOfStock = item.stock_quantity === 0;

                                return (
                                  <tr key={item.id} className="hover:bg-slate-50">
                                    <td className="p-4 pl-6">
                                      <img
                                        src={item.image}
                                        alt={item.name}
                                        className="w-10 h-10 rounded-lg object-cover bg-slate-150"
                                      />
                                    </td>
                                    <td className="p-4 font-bold text-slate-900">
                                      {item.name}
                                    </td>
                                    <td className="p-4 text-slate-500 uppercase tracking-wide text-[10px]">{item.category}</td>
                                    <td className="p-4">
                                      <span
                                        className={`font-mono text-xs font-bold px-2 py-1 rounded ${
                                          isOutOfStock
                                            ? "bg-red-100 text-red-650"
                                            : isLowStock
                                            ? "bg-amber-100 text-amber-650"
                                            : "bg-slate-100 text-slate-800"
                                        }`}
                                      >
                                        {item.stock_quantity}
                                      </span>
                                    </td>
                                    <td className="p-4">
                                      {item.is_available ? (
                                        <span className="text-emerald-600 flex items-center gap-1 font-bold">
                                          ● In stock
                                        </span>
                                      ) : (
                                        <span className="text-red-600 flex items-center gap-1 font-extrabold uppercase">
                                          ● Out of stock
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-4 pr-6 text-right space-x-1">
                                      <button
                                        type="button"
                                        onClick={() => quickAlterStock(item, 10)}
                                        className="bg-slate-900 text-white font-bold px-2 py-1 rounded text-[10px] uppercase hover:bg-indigo-600 transition tracking-wider"
                                      >
                                        +10 Raw
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => quickAlterStock(item, 50)}
                                        className="bg-slate-900 text-white font-bold px-2 py-1 rounded text-[10px] uppercase hover:bg-slate-930 transition tracking-wider"
                                      >
                                        +50 Bulk
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => quickAlterStock(item, -item.stock_quantity)}
                                        className="bg-slate-50 hover:bg-red-100 hover:text-red-600 text-slate-500 font-bold px-2 py-1 rounded text-[10px] border border-slate-200"
                                      >
                                        Reset Stock to 0
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: MENU MANAGEMENT AND RECIPE EDITING */}
                  {adminTab === "menu" && (
                    <div className="space-y-6 animate-fadeIn">
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {menuItems.map((item) => (
                          <div
                            key={item.id}
                            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between"
                          >
                            <div className="h-40 bg-slate-100 relative">
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute top-3 left-3 bg-slate-950/80 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                {item.category}
                              </div>
                            </div>

                            <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                              <div className="space-y-1">
                                <h3 className="font-bold text-slate-900 text-sm leading-tight">{item.name}</h3>
                                <p className="text-xs text-slate-400 line-clamp-2 leading-normal">{item.description}</p>
                              </div>

                              <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100">
                                <div>
                                  <p className="text-[9px] uppercase font-bold text-slate-400">Price tag</p>
                                  <p className="font-bold text-indigo-650 font-mono">${item.price.toFixed(2)}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[9px] uppercase font-bold text-slate-400 font-sans">Stock count</p>
                                  <p className="font-semibold text-slate-850 font-mono">{item.stock_quantity} available</p>
                                </div>
                              </div>

                              <div className="pt-2 flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditMenuItemModal(item)}
                                  className="bg-slate-100 text-slate-700 font-bold px-2.5 py-1.5 rounded-lg text-[10px] uppercase hover:bg-slate-200 transition"
                                >
                                  Edit Recipe
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteMenuItem(item.id)}
                                  className="bg-red-50 text-red-600 font-bold px-2.5 py-1.5 rounded-lg text-[10px] uppercase hover:bg-red-100 transition"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                    </div>
                  )}

                  {/* TAB 5: SETTINGS */}
                  {adminTab === "settings" && (
                    <div className="max-w-xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-fadeIn">
                      <div className="p-6 md:p-8 bg-slate-900 text-white border-b border-slate-800">
                        <h2 className="text-lg font-bold">Simulator Controls & Configuration</h2>
                        <p className="text-xs text-slate-400 mt-1">
                          Interact with the real-time databases securely using custom setup.
                        </p>
                      </div>

                      <div className="p-6 md:p-8 space-y-6">
                        <div className="space-y-2">
                          <h4 className="text-sm font-bold text-slate-900">Manager Security Credentials</h4>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Administration token session state utilizes cookies and localStorage variables dynamically stored under browser context.
                          </p>
                          <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200 space-y-1">
                            <p className="text-xs font-mono font-medium text-slate-700">Token ID: secure_admin_session_token_xyz</p>
                            <p className="text-[10px] text-emerald-600 font-bold uppercase">● Authenticated session validated</p>
                          </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-slate-100">
                          <h4 className="text-sm font-bold text-slate-900">Reset Initial Database</h4>
                          <p className="text-xs text-slate-500">
                            Clear order histories or revert raw menu records to stock defaults.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm("Do you want to clear your local testing order history as well?")) {
                                localStorage.removeItem("restaurant_customer_order_ids");
                                setCustomerOrders([]);
                                addToast("Customer persistent memory deleted beautifully.", "info");
                              }
                            }}
                            className="bg-rose-50 hover:bg-red-100 hover:text-red-700 text-rose-700 px-4 py-2 border border-red-200 text-xs font-bold uppercase rounded-lg tracking-wider block text-center w-full"
                          >
                            Delete Local Customer Orders History Cache
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                </main>
              </div>
            )}

          </div>
        )}

      </div>

      {/* FOOTER METRICS AND METADATA */}
      <footer className="bg-white border-t border-slate-100 py-6 px-4 shrink-0 transition-all select-none">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center text-xs text-slate-400 font-medium gap-3">
          <div className="flex items-center gap-1.5 uppercase font-bold tracking-widest text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Live Sourdough Sinks Active
          </div>
          <div className="text-center font-bold">
            &bull; Built with Next.js, Express, Tailwind CSS, and Dynamic Server-Sent Events &bull;
          </div>
          <div>
            &copy; 2026 Gourmet Studio Workspace Pro.
          </div>
        </div>
      </footer>

      {/* ADMIN DIALOG / REJECTION REASON SCREEN */}
      {rejectingOrder && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden w-full max-w-md shadow-xl">
            <div className="p-4 md:p-6 bg-red-650 text-white flex justify-between items-center">
              <h3 className="font-extrabold text-white text-base">Provide Rejection Explanation</h3>
              <button
                onClick={() => setRejectingOrder(null)}
                className="text-white hover:text-slate-200 font-bold text-lg"
              >
                &times;
              </button>
            </div>
            
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateOrderStatus(rejectingOrder.id, "Rejected", rejectionReasonInput || "Kitchen currently experiencing high demand.");
                setRejectingOrder(null);
              }}
              className="p-6 md:p-8 space-y-4"
            >
              <p className="text-xs text-slate-500 leading-relaxed">
                Provide the reasons why order <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1 rounded">{rejectingOrder.id}</span> is being declined. This is broadcasted live onto client devices instantly!
              </p>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Formal Reason *</label>
                <input
                  type="text"
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  placeholder="e.g. Sourdough stocks completely finished, kitchen closes temporarily."
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-red-600 text-slate-900"
                  required
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setRejectingOrder(null)}
                  className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl text-slate-600 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-xl"
                >
                  Confirm Rejection & Notify Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SELECTIVE VIEW DETAILED ORDER ACCORDION MODAL (ADMIN AREA) */}
      {selectedOrderForModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden w-full max-w-lg">
            
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <span className="font-mono text-[10px] text-indigo-400 font-bold block">{selectedOrderForModal.id}</span>
                <h3 className="font-black text-sm">{selectedOrderForModal.customer_name} Ordering History</h3>
              </div>
              <button
                onClick={() => setSelectedOrderForModal(null)}
                className="text-slate-400 hover:text-white font-bold text-lg"
              >
                &times;
              </button>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              
              <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-500">
                <div>
                  <p className="text-[9px] uppercase font-bold tracking-wider mb-1">State Status</p>
                  <span className="bg-slate-150 text-slate-800 px-2.5 py-1 rounded font-bold uppercase tracking-wide">
                    {selectedOrderForModal.status}
                  </span>
                </div>

                <div>
                  <p className="text-[9px] uppercase font-bold tracking-wider mb-1">Date Created</p>
                  <p className="text-slate-900 font-medium">{new Date(selectedOrderForModal.created_at).toLocaleString()}</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Ordered Meals ({selectedOrderForModal.items.length})</p>
                <div className="divide-y divide-slate-105">
                  {selectedOrderForModal.items.map((it, idx) => (
                    <div key={idx} className="py-2 first:pt-0 last:pb-0 flex justify-between items-center text-xs">
                      <span className="text-slate-700 font-semibold">
                        <span className="font-mono font-bold text-slate-900 border border-slate-200 px-1.5 py-0.2 bg-white rounded mr-1">{it.quantity}x</span> {it.name}
                      </span>
                      <span className="font-mono text-slate-800 font-bold">${it.subtotal.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-200/80 flex justify-between items-baseline">
                  <span className="text-xs font-bold text-slate-500">Total Charged Bill</span>
                  <span className="text-lg font-black text-slate-900 font-mono">${selectedOrderForModal.total_amount.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <p className="text-[9px] uppercase font-bold tracking-wider text-slate-400">Shipped Destination</p>
                <p className="text-slate-900 font-semibold">{selectedOrderForModal.customer_name} &bull; {selectedOrderForModal.phone}</p>
                <p className="text-slate-500 pr-4 leading-relaxed">{selectedOrderForModal.address}</p>
              </div>

              {selectedOrderForModal.notes && (
                <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-indigo-900 text-xs">
                  <span className="font-black">Sender Memo:</span> {selectedOrderForModal.notes}
                </div>
              )}

              {selectedOrderForModal.rejection_reason && (
                <div className="p-3 bg-red-50 border border-red-105 text-red-905 font-mono text-xs rounded-xl">
                  <span className="font-bold uppercase block text-[9px] mb-1">Rejection Alert:</span>
                  {selectedOrderForModal.rejection_reason}
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2 text-xs font-bold">
                <button
                  onClick={() => setSelectedOrderForModal(null)}
                  className="bg-slate-950 py-2.5 px-6 rounded-xl hover:bg-slate-900 transition text-white uppercase text-[10px] tracking-wider font-sans cursor-pointer"
                >
                  Close Receipt Screen
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* CREATE AND EDIT MENU MODAL */}
      {isAddingMenuItem && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden w-full max-w-lg">
            
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-black text-white text-base">
                {editingMenuItem ? `Edit Recipe: ${editingMenuItem.name}` : "Create Culinary Signature Recipe"}
              </h3>
              <button
                onClick={() => { setIsAddingMenuItem(false); setEditingMenuItem(null); clearMenuForm(); }}
                className="text-slate-400 hover:text-white font-bold text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleMenuSubmit} className="p-6 md:p-8 space-y-4">
              
              {menuFormError && (
                <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-semibold">
                  {menuFormError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Culinary Name *</label>
                  <input
                    type="text"
                    value={menuFormName}
                    onChange={(e) => setMenuFormName(e.target.value)}
                    placeholder="e.g. Royal Pepperoni Sourdough"
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-indigo-600 text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Catalog Category *</label>
                  <select
                    value={menuFormCategory}
                    onChange={(e) => setMenuFormCategory(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 bg-white rounded-xl text-xs focus:outline-none focus:border-indigo-600 text-slate-900"
                  >
                    <option value="Pizzas">Pizzas</option>
                    <option value="Burgers">Burgers</option>
                    <option value="Drinks">Drinks</option>
                    <option value="Desserts">Desserts</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Short Gourmet description</label>
                <textarea
                  value={menuFormDescription}
                  onChange={(e) => setMenuFormDescription(e.target.value)}
                  placeholder="Describe recipe components, spices, crust details etc."
                  rows={2}
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-indigo-600 text-slate-900 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Selling Price ($ USD) *</label>
                  <input
                    type="text"
                    value={menuFormPrice}
                    onChange={(e) => setMenuFormPrice(e.target.value)}
                    placeholder="12.99"
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-indigo-600 text-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Initial Kitchen Stock *</label>
                  <input
                    type="number"
                    value={menuFormStock}
                    onChange={(e) => setMenuFormStock(e.target.value)}
                    placeholder="25"
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-indigo-600 text-slate-900/90"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1 font-sans">Unsplash Food Image Address (URL)</label>
                <input
                  type="url"
                  value={menuFormImage}
                  onChange={(e) => setMenuFormImage(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-..."
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-indigo-600 text-slate-900"
                />
                <p className="text-[9px] text-slate-400 mt-1">
                  Leave empty to let system fallback onto delicious catalog vector images.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => { setIsAddingMenuItem(false); setEditingMenuItem(null); clearMenuForm(); }}
                  className="bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl shadow-md"
                >
                  {editingMenuItem ? "Save Changes" : "Publish Culinary Recipe"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
