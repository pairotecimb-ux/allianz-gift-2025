import { useState, useEffect } from 'react';
import { ShoppingBag, CheckCircle, Lock, Database, Edit, Trash2, Plus, Eye, EyeOff, Save, LogOut, X, Package, MapPin, Phone, Truck, Handshake, MessageCircle, Receipt, ZoomIn, Tag, Search, Download, Clock, CheckSquare, Layers, Megaphone, Star, ChevronRight, Gift, CalendarCheck, Folder, Power } from 'lucide-react';
import { db } from './firebase'; 
import { collection, addDoc, getDocs, orderBy, query, Timestamp, doc, updateDoc, deleteDoc, setDoc, getDoc, where } from 'firebase/firestore';

// --- รหัสผ่านเข้าหลังบ้าน ---
const ADMIN_PASSWORD = "4242"; 

// --- หมวดหมู่เริ่มต้น (สำหรับสร้างครั้งแรก) ---
const INITIAL_CATEGORIES = ["Lifestyle", "Gadget", "Fashion", "Home", "Travel"];

// --- ข้อมูลสินค้าเริ่มต้น (Mockup) ---
const INITIAL_PRODUCTS = [
  { id: '1', code: "BAG-001", name: "กระเป๋าเดินทาง 20 นิ้ว", category: "Travel", description: "รุ่น Limited Edition แข็งแรง ทนทาน", imageUrl: "https://images.unsplash.com/photo-1565026057447-bc072a804e8f?w=1000", active: true, isNew: true, stock: 10, options: ["สี Midnight Blue", "สี Silver Grey", "สี Rose Gold"] },
  { id: '2', code: "SHIRT-L", name: "เสื้อโปโล Allianz", category: "Fashion", description: "เนื้อผ้าใส่สบาย ระบายอากาศดีเยี่ยม", imageUrl: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=1000", active: true, isNew: false, stock: 20, options: ["S", "M", "L", "XL", "XXL"] },
  { id: '3', code: "GIFT-SET", name: "ชุด Gift Set รักษ์โลก", category: "Lifestyle", description: "แก้วน้ำเก็บความเย็น + ถุงผ้าลดโลกร้อน", imageUrl: "https://images.unsplash.com/photo-1542435503-956c469947f6?w=1000", active: true, isNew: true, stock: 5, options: [] },
];

export default function App() {
  // --- States ---
  const [view, setView] = useState('home'); // home, admin, login
  const [products, setProducts] = useState<any[]>([]); 
  const [categories, setCategories] = useState<any[]>([]); // New: Dynamic Categories
  
  // Filtering Logic
  const [selectedCategory, setSelectedCategory] = useState("ทั้งหมด");

  // Banner Settings
  const [bannerSettings, setBannerSettings] = useState({
    bannerUrl: "", 
    title: "ของขวัญพิเศษ แทนคำขอบคุณ",
    subtitle: "Privilege 2025",
    showAnnouncement: true,
    announcementText: "🎉 แลกรับได้ตั้งแต่วันนี้ - 15 มกราคม 2569 เท่านั้น!",
  });
  const [isBannerLoaded, setIsBannerLoaded] = useState(false);

  // Modal States
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false); 
  const [selectedProduct, setSelectedProduct] = useState<any>(null); 
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [viewingImage, setViewingImage] = useState<string | null>(null); 
  
  const [loading, setLoading] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery');
  
  const [formData, setFormData] = useState({ name: '', phone: '', address: '', pickupDate: '', remark: '' }); 
  const [finalDeliveryMethod, setFinalDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery'); 
  
  // Admin States
  const [orders, setOrders] = useState<any[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]); 
  const [searchTerm, setSearchTerm] = useState(''); 
  const [adminPassInput, setAdminPassInput] = useState(''); 
  const [adminTab, setAdminTab] = useState('orders'); // orders, products, categories, settings
  const [editingProduct, setEditingProduct] = useState<any>(null); 
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0 });
  const [newCategoryName, setNewCategoryName] = useState('');

  // Check Order (Customer)
  const [isCheckOrderOpen, setIsCheckOrderOpen] = useState(false);
  const [checkOrderPhone, setCheckOrderPhone] = useState('');
  const [myOrders, setMyOrders] = useState<any[] | null>(null);
  const [isSearchingOrder, setIsSearchingOrder] = useState(false);

  // --- FIX Viewport ---
  useEffect(() => {
    const metaId = 'viewport-meta-tag-force';
    let meta = document.getElementById(metaId) as HTMLMetaElement;
    if (!meta) {
      meta = document.createElement('meta');
      meta.id = metaId;
      meta.name = 'viewport';
      document.head.appendChild(meta);
    }
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
  }, []);

  // --- 1. โหลดข้อมูล ---
  useEffect(() => {
    fetchContent();
  }, []); 

  // --- Search Logic & Stats (Admin) ---
  useEffect(() => {
    const total = orders.length;
    const pending = orders.filter(o => o.status !== 'completed' && o.status !== 'confirmed_date').length;
    const completed = orders.filter(o => o.status === 'completed').length;
    setStats({ total, pending, completed });

    if (searchTerm.trim() === '') {
      setFilteredOrders(orders);
    } else {
      const lowerTerm = searchTerm.toLowerCase();
      const filtered = orders.filter(o => 
        o.name?.toLowerCase().includes(lowerTerm) ||
        o.phone?.includes(lowerTerm) ||
        o.productCode?.toLowerCase().includes(lowerTerm) ||
        o.productOption?.toLowerCase().includes(lowerTerm)
      );
      setFilteredOrders(filtered);
    }
  }, [searchTerm, orders]);

  const fetchContent = async () => {
    setLoading(true);
    try {
      // 1. Fetch Categories (New Logic)
      const cQuery = query(collection(db, "categories"), orderBy("timestamp", "asc"));
      const cSnapshot = await getDocs(cQuery);
      let cList = cSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (cList.length === 0) {
          // ถ้ายังไม่มีหมวดหมู่ใน DB ให้สร้าง Default
          for (const catName of INITIAL_CATEGORIES) {
              await addDoc(collection(db, "categories"), { 
                  name: catName, 
                  active: true,
                  timestamp: Timestamp.now()
              });
          }
          // Fetch again
          const newCSnapshot = await getDocs(query(collection(db, "categories"), orderBy("timestamp", "asc")));
          cList = newCSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
      setCategories(cList);

      // 2. Fetch Products
      const pQuery = query(collection(db, "products"));
      const pSnapshot = await getDocs(pQuery); 
      let pList = pSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (pList.length === 0) {
        for (const p of INITIAL_PRODUCTS) {
          await setDoc(doc(db, "products", p.id), p);
        }
        pList = INITIAL_PRODUCTS; 
      }
      setProducts(pList);

      // 3. Fetch Settings
      const settingSnap = await getDoc(doc(db, "settings", "main"));
      if (settingSnap.exists()) {
        const data = settingSnap.data();
        setBannerSettings(prev => ({ ...prev, ...data })); 
      } else {
        const defaultBanner = "https://images.unsplash.com/photo-1513201099705-a9746e1e201f?w=2000";
        setBannerSettings(prev => ({...prev, bannerUrl: defaultBanner}));
        await setDoc(doc(db, "settings", "main"), { ...bannerSettings, bannerUrl: defaultBanner });
      }
      setIsBannerLoaded(true);

    } catch (err) {
      console.error("Error fetching:", err);
    }
    setLoading(false); 
  };

  const resizeImage = (file: File, callback: (dataUrl: string) => void) => {
    const reader = new FileReader();
    reader.onload = (event: any) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 800; 
        const MAX_HEIGHT = 800;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7); 
        callback(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleProductImageUpload = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      resizeImage(file, (dataUrl) => {
        setEditingProduct({ ...editingProduct, imageUrl: dataUrl });
      });
    }
  };

  const handleBannerImageUpload = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      resizeImage(file, (dataUrl) => {
        setBannerSettings({ ...bannerSettings, bannerUrl: dataUrl });
      });
    }
  };

  const exportToCSV = () => {
    if (orders.length === 0) {
        alert("ไม่มีข้อมูลออเดอร์ให้ Export ครับ");
        return;
    }
    const headers = ["วันที่", "สถานะ", "Tracking No.", "ประเภทการรับ", "ชื่อลูกค้า", "เบอร์โทร", "สินค้า", "ตัวเลือก (Option)", "รหัสสินค้า", "ที่อยู่ / จุดนัดรับ", "วันนัดรับ", "หมายเหตุ"];
    const csvContent = [
      headers.join(","), 
      ...orders.map(o => {
        const date = o.timestamp?.toDate().toLocaleDateString('th-TH') || '-';
        let statusText = 'รอตรวจสอบ';
        if (o.status === 'completed') statusText = 'จัดส่งแล้ว';
        if (o.status === 'confirmed_date') statusText = 'ยืนยันวันเวลาแล้ว';
        
        const tracking = `"${o.trackingNumber || '-'}"`; 
        const type = o.deliveryMethod || '-';
        const name = `"${o.name || ''}"`;
        const phone = `"${o.phone || ''}"`;
        const product = `"${o.product || ''}"`;
        const option = `"${o.productOption || '-'}"`;
        const code = `"${o.productCode || ''}"`;
        const address = `"${(o.address || '').replace(/\n/g, ' ')}"`;
        const pickupDate = o.pickupDate ? new Date(o.pickupDate).toLocaleString('th-TH') : '-';
        const remark = `"${o.remark || ''}"`;
        return [date, statusText, tracking, type, name, phone, product, option, code, address, pickupDate, remark].join(",");
      })
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `orders_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Search Order Logic ---
  const handleCheckOrderSearch = async (e: any) => {
      e.preventDefault();
      if (!checkOrderPhone.trim()) return;
      setIsSearchingOrder(true);
      try {
        const q = query(collection(db, "orders"), where("phone", "==", checkOrderPhone.trim()));
        const snapshot = await getDocs(q);
        const foundOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        foundOrders.sort((a: any, b: any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        setMyOrders(foundOrders);
      } catch (error: any) {
        console.error("Search Error:", error);
        alert("เกิดข้อผิดพลาดในการค้นหา: " + error.message);
      }
      setIsSearchingOrder(false);
  };

  const handleSubmitOrder = async (e: any) => {
    e.preventDefault();
    if (selectedProduct.options && selectedProduct.options.length > 0 && !selectedOption) {
        alert("กรุณาเลือกตัวเลือกสินค้า (เช่น สี หรือ ไซซ์) ก่อนครับ");
        return;
    }

    setLoading(true); 
    try {
        const productRef = doc(db, "products", selectedProduct.id);
        const productSnap = await getDoc(productRef);
        
        if (productSnap.exists()) {
            const currentStock = productSnap.data().stock || 0;
            if (currentStock <= 0) {
                alert("เสียใจด้วย สินค้าชิ้นนี้หมดพอดีครับ");
                setLoading(false);
                setIsOrderModalOpen(false); 
                fetchContent();
                return;
            }

            const finalPickupDate = deliveryMethod === 'delivery' ? '' : formData.pickupDate;
            const finalDeliveryText = deliveryMethod === 'delivery' ? 'จัดส่งถึงบ้าน' : 'นัดรับ';

            await addDoc(collection(db, "orders"), {
                ...formData,
                pickupDate: finalPickupDate,
                deliveryMethod: finalDeliveryText,
                product: selectedProduct.name,
                productId: selectedProduct.id,
                productCode: selectedProduct.code || '-',
                productOption: selectedOption || '-',
                timestamp: Timestamp.now(),
                status: 'pending' 
            });

            await updateDoc(productRef, { stock: currentStock - 1 });
            setFinalDeliveryMethod(deliveryMethod); 
            setLoading(false);
            setIsOrderModalOpen(false); 
            setIsSuccessModalOpen(true); 
            fetchContent();
        }
    } catch (error: any) {
      alert("เกิดข้อผิดพลาด: " + error.message);
      setLoading(false);
    }
  };

  const handleLogin = (e: any) => {
    e.preventDefault();
    if (adminPassInput === ADMIN_PASSWORD) { 
      fetchOrders();
      setView('admin');
      setAdminPassInput('');
    } else {
      alert("รหัสผ่านไม่ถูกต้อง");
    }
  };

  const fetchOrders = async () => {
    const q = query(collection(db, "orders"), orderBy("timestamp", "desc"));
    const querySnapshot = await getDocs(q); 
    const orderList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setOrders(orderList);
    setFilteredOrders(orderList); 
  };

  const handleToggleStatus = async (order: any) => {
    let newStatus = 'pending';
    if (order.status === 'pending') newStatus = 'confirmed_date';
    else if (order.status === 'confirmed_date') newStatus = 'completed';
    else newStatus = 'pending';

    const updatedOrders = orders.map(o => o.id === order.id ? {...o, status: newStatus} : o);
    setOrders(updatedOrders);
    await updateDoc(doc(db, "orders", order.id), { status: newStatus });
  };

  const handleSaveProduct = async (e: any) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      let optionsArray: string[] = [];
      if (editingProduct.optionsString) {
          optionsArray = editingProduct.optionsString.split(',').map((s:string) => s.trim()).filter((s:string) => s !== '');
      } else if (Array.isArray(editingProduct.options)) {
          optionsArray = editingProduct.options;
      }

      const productData = {
          ...editingProduct,
          stock: parseInt(editingProduct.stock) || 0,
          code: editingProduct.code || '',
          category: editingProduct.category || categories[0]?.name || 'Lifestyle',
          isNew: editingProduct.isNew || false,
          options: optionsArray
      };
      delete productData.optionsString;

      const isNew = !editingProduct.id;
      if (isNew) { 
        await addDoc(collection(db, "products"), { ...productData, active: true });
      } else {
        const { id, ...data } = productData;
        await updateDoc(doc(db, "products", id), data); 
      }
      setEditingProduct(null);
      fetchContent();
    } catch (err: any) { alert("Error: " + err.message); } 
  };

  const handleDeleteProduct = async (id: string) => {
    if(!confirm("ยืนยันการลบสินค้า?")) return;
    await deleteDoc(doc(db, "products", id)); 
    fetchContent();
  };

  const handleToggleProduct = async (product: any) => {
    await updateDoc(doc(db, "products", product.id), { active: !product.active });
    fetchContent();
  };

  const handleDeleteOrder = async (id: string) => {
    if(!confirm("ยืนยันการลบออเดอร์นี้? (กู้คืนไม่ได้)")) return;
    await deleteDoc(doc(db, "orders", id)); 
    fetchOrders();
  };

  const handleSaveOrder = async (e: any) => {
    e.preventDefault();
    if (!editingOrder) return;
    try {
      const { id, ...data } = editingOrder;
      if (data.deliveryMethod === 'จัดส่งถึงบ้าน') {
          data.pickupDate = '';
      }
      await updateDoc(doc(db, "orders", id), data); 
      setEditingOrder(null);
      fetchOrders();
      alert("บันทึกข้อมูลเรียบร้อย");
    } catch (err: any) { alert("บันทึกออเดอร์ไม่สำเร็จ: " + err.message); }
  };

  const handleSaveBanner = async () => {
    await setDoc(doc(db, "settings", "main"), bannerSettings); 
    alert("บันทึกการตั้งค่าหน้าเว็บเรียบร้อย");
  };

  // --- Category Management Functions ---
  const handleAddCategory = async (e: any) => {
      e.preventDefault();
      if (!newCategoryName.trim()) return;
      try {
          await addDoc(collection(db, "categories"), {
              name: newCategoryName.trim(),
              active: true,
              timestamp: Timestamp.now()
          });
          setNewCategoryName('');
          fetchContent(); // Refresh
      } catch (err: any) { alert("Error adding category: " + err.message); }
  };

  const handleToggleCategory = async (cat: any) => {
      try {
          await updateDoc(doc(db, "categories", cat.id), { active: !cat.active });
          fetchContent();
      } catch (err: any) { alert("Error toggling: " + err.message); }
  };

  const handleDeleteCategory = async (id: string) => {
      if (!confirm("ยืนยันลบหมวดหมู่นี้? (สินค้าในหมวดนี้จะยังอยู่ แต่ filter อาจจะไม่ตรง)")) return;
      try {
          await deleteDoc(doc(db, "categories", id));
          fetchContent();
      } catch (err: any) { alert("Error deleting: " + err.message); }
  };

  const openEditProduct = (p: any) => {
      let optionsStr = '';
      if (p.options && Array.isArray(p.options)) {
          optionsStr = p.options.join(', ');
      }
      setEditingProduct({ ...p, optionsString: optionsStr });
  };

  // --- Filter Products ---
  const getFilteredProducts = () => {
      if (selectedCategory === "ทั้งหมด") {
          return products;
      }
      return products.filter(p => p.category === selectedCategory);
  };

  const Footer = () => (
    <footer className="w-full bg-white border-t border-gray-200 py-6 text-center mt-auto">
      <div className="container mx-auto px-4">
        <p className="text-gray-600 text-sm md:text-base">
          © 2025 Allianz Ayudhya. สงวนสิทธิ์ 1 ท่านต่อ 1 สิทธิ์ <br/>
          <span className="text-xs text-gray-400">Campaign by นัท อลิอันซ์ v14.0</span> 
        </p>
      </div>
    </footer>
  ); 

  const ImageModal = () => {
      if (!viewingImage) return null;
      return (
          <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-fade-in" onClick={() => setViewingImage(null)}>
              <button className="absolute top-4 right-4 text-white bg-white/20 rounded-full p-2 hover:bg-white/40">
                  <X size={24} />
              </button>
              <img src={viewingImage} className="max-w-full max-h-[90vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()}/>
          </div>
      );
  };

  // --- Modal: Check Order ---
  const renderCheckOrderModal = () => {
    if (!isCheckOrderOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-slide-up">
                <div className="bg-[#003781] p-4 flex justify-between items-center">
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                        <Package size={20}/> ติดตามสถานะพัสดุ
                    </h3>
                    <button onClick={() => {setIsCheckOrderOpen(false); setMyOrders(null); setCheckOrderPhone('')}} className="text-white/80 hover:text-white">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-6">
                    <form onSubmit={handleCheckOrderSearch} className="flex gap-2 mb-6">
                        <input 
                            type="tel" 
                            className="flex-1 border rounded-xl p-3 text-gray-800 outline-none focus:ring-2 focus:ring-[#003781]"
                            placeholder="กรอกเบอร์โทรศัพท์ของคุณ..."
                            value={checkOrderPhone}
                            onChange={e => setCheckOrderPhone(e.target.value)}
                            autoFocus
                        />
                        <button type="submit" disabled={isSearchingOrder} className="bg-[#003781] text-white px-6 rounded-xl font-bold hover:bg-[#002860] disabled:bg-gray-400">
                            {isSearchingOrder ? '...' : 'ค้นหา'}
                        </button>
                    </form>

                    <div className="space-y-4 max-h-[50vh] overflow-y-auto">
                        {myOrders === null ? (
                            <div className="text-center py-8 text-gray-400">
                                <Search size={48} className="mx-auto mb-2 opacity-20"/>
                                <p>กรอกเบอร์โทรเพื่อค้นหาออเดอร์</p>
                            </div>
                        ) : myOrders.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                ไม่พบข้อมูลออเดอร์ของเบอร์นี้
                            </div>
                        ) : (
                            myOrders.map(order => {
                                let statusBadge;
                                if (order.status === 'completed') {
                                    statusBadge = (
                                        <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1">
                                            <CheckCircle size={12}/> จัดส่งแล้ว
                                        </span>
                                    );
                                } else if (order.status === 'confirmed_date') {
                                    statusBadge = (
                                        <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1">
                                            <CalendarCheck size={12}/> ยืนยันวันเวลานัดรับแล้ว
                                        </span>
                                    );
                                } else {
                                    statusBadge = (
                                        <span className="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1">
                                            <Clock size={12}/> รอดำเนินการ
                                        </span>
                                    );
                                }

                                return (
                                <div key={order.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50 hover:bg-white hover:shadow-md transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="font-bold text-[#003781]">{order.product}</p>
                                            {order.productOption && order.productOption !== '-' && <span className="text-xs text-gray-500">({order.productOption})</span>}
                                            <p className="text-xs text-gray-400 mt-1">วันที่แลก: {order.timestamp?.toDate().toLocaleDateString('th-TH')}</p>
                                        </div>
                                        {statusBadge}
                                    </div>
                                    <div className="text-sm text-gray-600 border-t border-gray-200 pt-2 mt-2">
                                        <p className="flex items-center gap-2">
                                            {order.deliveryMethod === 'จัดส่งถึงบ้าน' ? <Truck size={14}/> : <MapPin size={14}/>}
                                            {order.deliveryMethod}
                                        </p>
                                        
                                        {order.status === 'confirmed_date' && order.pickupDate && (
                                             <div className="mt-2 bg-emerald-50 p-2 border border-emerald-100 rounded text-emerald-800 text-sm font-bold flex items-center gap-2">
                                                <CalendarCheck size={16}/> 
                                                <span>เวลานัด: {new Date(order.pickupDate).toLocaleString('th-TH')}</span>
                                            </div>
                                        )}

                                        {order.trackingNumber && (
                                            <div className="mt-2 bg-blue-50 p-2 border border-blue-100 rounded text-blue-800 text-sm font-mono flex items-center gap-2">
                                                📦 <b>Track:</b> {order.trackingNumber}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )})
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
  }

  // --- Modal: Success Popup ---
  const renderSuccessModal = () => {
      if (!isSuccessModalOpen) return null;
      return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => {setIsSuccessModalOpen(false); setView('home'); window.location.reload();}}></div>
             
             <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl relative animate-slide-up overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="bg-[#003781] h-3"></div>
                <div className="p-6 md:p-8 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4 shadow-sm border border-blue-100">
                        <Gift className="text-[#003781] w-10 h-10 animate-bounce" />
                    </div>
                    <h2 className="text-2xl font-bold text-[#003781] mb-2">ขอบคุณที่ร่วมกิจกรรม</h2>
                    
                    <p className="text-gray-500 text-sm mb-6">
                        ระบบได้รับข้อมูลเรียบร้อยแล้ว <br/>
                        สามารถตรวจสอบสถานะได้ที่ปุ่ม "ตรวจสอบสถานะ" <br/>
                        {finalDeliveryMethod === 'pickup' ? (
                            <span className="font-bold text-orange-600">การยืนยันวันและเวลา อีกครั้ง ภายใน 1-3 วันทำการ</span>
                        ) : (
                             <span className="font-bold text-blue-600">ภายใน 1-3 วันทำการ</span>
                        )}
                    </p>

                    <div className="w-full bg-gray-50 rounded-2xl p-5 border border-gray-200 mb-6 text-left relative overflow-hidden">
                         <div className="absolute top-0 right-0 p-2 opacity-5"><Receipt size={100}/></div>
                         <h3 className="font-bold text-gray-800 border-b border-gray-200 pb-2 mb-3 flex items-center gap-2 text-sm">
                            <Receipt size={16}/> สรุปรายการ
                         </h3>
                         <div className="space-y-2 text-sm text-gray-700 relative z-10">
                            <div className="grid grid-cols-[80px_1fr] gap-2">
                                <span className="text-gray-500">สินค้า:</span>
                                <span className="font-bold text-[#003781]">{selectedProduct?.name}</span>
                            </div>
                            {selectedOption && (
                                <div className="grid grid-cols-[80px_1fr] gap-2">
                                    <span className="text-gray-500">ตัวเลือก:</span>
                                    <span className="font-bold">{selectedOption}</span>
                                </div>
                            )}
                            <div className="grid grid-cols-[80px_1fr] gap-2">
                                <span className="text-gray-500">ชื่อ:</span>
                                <span className="font-bold">{formData.name}</span>
                            </div>
                            <div className="grid grid-cols-[80px_1fr] gap-2">
                                <span className="text-gray-500">เบอร์โทร:</span>
                                <span className="font-bold">{formData.phone}</span>
                            </div>
                            <div className="grid grid-cols-[80px_1fr] gap-2">
                                <span className="text-gray-500">{finalDeliveryMethod === 'delivery' ? 'ที่อยู่:' : 'จุดนัดรับ:'}</span>
                                <span className="font-medium break-words">{formData.address}</span>
                            </div>
                            {finalDeliveryMethod === 'pickup' && formData.pickupDate && (
                                <div className="grid grid-cols-[80px_1fr] gap-2">
                                    <span className="text-gray-500">เวลานัด:</span>
                                    <span className="font-bold text-orange-600">{new Date(formData.pickupDate).toLocaleString('th-TH')}</span>
                                </div>
                            )}
                            {formData.remark && (
                                <div className="grid grid-cols-[80px_1fr] gap-2">
                                    <span className="text-gray-500">หมายเหตุ:</span>
                                    <span className="font-medium italic text-gray-600">{formData.remark}</span>
                                </div>
                            )}
                         </div>
                    </div>

                    <div className="w-full space-y-3">
                        <a href="https://line.me/R/ti/p/@386cqgdi" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full bg-[#00B900] hover:bg-[#009900] text-white py-3.5 rounded-xl font-bold transition-all shadow-md active:scale-95 text-sm">
                            <MessageCircle size={20} /> หากมีข้อสงสัย สอบถามที่ Line OA
                        </a>
                        <button onClick={() => {setIsSuccessModalOpen(false); setFormData({ name: '', phone: '', address: '', pickupDate: '', remark: '' }); setView('home'); window.location.reload();}} className="w-full bg-gray-100 text-gray-600 hover:text-[#003781] px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all text-sm">
                            ปิดหน้าต่าง
                        </button>
                    </div>
                </div>
             </div>
        </div>
      );
  };

  // --- Modal: Order Form ---
  const renderOrderModal = () => {
    if (!isOrderModalOpen || !selectedProduct) return null;
    return (
        <div className="fixed inset-0 z-[55] flex items-center justify-center p-0 md:p-4">
             <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOrderModalOpen(false)}></div>
             
             <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-4xl md:rounded-2xl shadow-2xl overflow-y-auto relative animate-slide-up flex flex-col">
                <div className="sticky top-0 bg-white z-10 border-b p-4 flex justify-between items-center shadow-sm">
                    <h3 className="font-bold text-lg md:text-xl text-[#003781] flex items-center gap-2">
                        <ShoppingBag size={20}/> รายละเอียดการแลกของขวัญ
                    </h3>
                    <button onClick={() => setIsOrderModalOpen(false)} className="bg-gray-100 p-2 rounded-full hover:bg-gray-200">
                        <X size={24} className="text-gray-600"/>
                    </button>
                </div>
                
                <div className="p-4 md:p-8 flex flex-col md:flex-row gap-6 md:gap-8">
                    {/* Left: Product Info */}
                    <div className="w-full md:w-1/3 flex flex-col items-center text-center">
                         <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-gray-200 mb-4 group cursor-zoom-in" onClick={() => setViewingImage(selectedProduct.imageUrl)}>
                            <img src={selectedProduct.imageUrl} className="w-full h-full object-cover"/>
                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-all">
                                <ZoomIn className="text-white opacity-0 group-hover:opacity-100 drop-shadow-md"/>
                            </div>
                         </div>
                         <h2 className="text-xl font-bold text-gray-900 mb-2">{selectedProduct.name}</h2>
                         <p className="text-sm text-gray-500 mb-4">{selectedProduct.description}</p>
                         
                         <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 mb-4">
                            <Star size={16} fill="currentColor"/> ใช้ 1 สิทธิ์
                         </div>

                         <div className={`text-sm font-bold px-3 py-1 rounded-full ${selectedProduct.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                             {selectedProduct.stock > 0 ? `เหลือ ${selectedProduct.stock} ชิ้น` : 'สินค้าหมด'}
                         </div>
                    </div>

                    {/* Right: Form */}
                    <div className="w-full md:w-2/3 border-t md:border-t-0 md:border-l border-gray-100 pt-6 md:pt-0 md:pl-8">
                        <form onSubmit={handleSubmitOrder} className="space-y-6">
                            {selectedProduct.options && selectedProduct.options.length > 0 && (
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-800">เลือกแบบ / สี / ไซซ์ <span className="text-red-500">*</span></label>
                                    <select required className="w-full p-3 rounded-xl border bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#003781] outline-none transition" value={selectedOption} onChange={(e) => setSelectedOption(e.target.value)}>
                                        <option value="" disabled>-- กรุณาเลือก --</option>
                                        {selectedProduct.options.map((opt: string, idx: number) => (
                                            <option key={idx} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-800">วิธีการรับของ <span className="text-red-500">*</span></label>
                                <div className="flex gap-4">
                                    <label className={`flex-1 p-4 rounded-xl border-2 cursor-pointer flex flex-col items-center gap-2 transition ${deliveryMethod === 'delivery' ? 'border-[#003781] bg-blue-50 text-[#003781]' : 'border-gray-200 text-gray-500'}`}>
                                        <input type="radio" name="delivery" className="hidden" checked={deliveryMethod === 'delivery'} onChange={() => setDeliveryMethod('delivery')} />
                                        <Truck size={24}/> <span className="text-sm font-bold">จัดส่งถึงบ้าน</span>
                                    </label>
                                    <label className={`flex-1 p-4 rounded-xl border-2 cursor-pointer flex flex-col items-center gap-2 transition ${deliveryMethod === 'pickup' ? 'border-[#003781] bg-blue-50 text-[#003781]' : 'border-gray-200 text-gray-500'}`}>
                                        <input type="radio" name="delivery" className="hidden" checked={deliveryMethod === 'pickup'} onChange={() => setDeliveryMethod('pickup')} />
                                        <Handshake size={24}/> <span className="text-sm font-bold">สะดวกนัดรับ</span>
                                    </label>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-bold text-gray-800 mb-1 block">ชื่อ-นามสกุล <span className="text-red-500">*</span></label>
                                    <input required className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-[#003781] outline-none" placeholder="ชื่อจริง" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-gray-800 mb-1 block">เบอร์โทร <span className="text-red-500">*</span></label>
                                    <input required type="tel" className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-[#003781] outline-none" placeholder="08x-xxx-xxxx" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-bold text-gray-800 mb-1 block">{deliveryMethod === 'delivery' ? 'ที่อยู่จัดส่ง' : 'สถานที่นัดรับ'} <span className="text-red-500">*</span></label>
                                <textarea required rows={2} className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-[#003781] outline-none resize-none" 
                                    placeholder={deliveryMethod === 'delivery' ? "บ้านเลขที่, ถนน, แขวง, เขต, จ.รหัสไปรษณีย์" : "ระบุสถานที่ เช่น BTS สยาม, เซ็นทรัลลาดพร้าว, บ้านลูกค้า/บ้านตัวแทน, ฯลฯ ใน กทม."} 
                                    value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                            </div>

                            {deliveryMethod === 'pickup' && (
                                <div className="bg-orange-50 p-3 rounded-xl border border-orange-200 animate-fade-in">
                                    <label className="text-sm font-bold text-orange-800 mb-1 block">วันเวลานัดรับ <span className="text-red-500">*</span></label>
                                    <input required type="datetime-local" 
                                        className="w-full p-3 rounded-xl border bg-white focus:ring-2 focus:ring-[#003781] outline-none cursor-pointer" 
                                        value={formData.pickupDate} 
                                        onChange={e => setFormData({...formData, pickupDate: e.target.value})} 
                                        onClick={(e) => e.currentTarget.showPicker()}
                                    />
                                </div>
                            )}

                            <div>
                                <label className="text-sm font-bold text-gray-500 mb-1 block">หมายเหตุ (ถ้ามี)</label>
                                <input className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-[#003781] outline-none" placeholder="ฝากข้อความถึงผู้ส่ง" value={formData.remark} onChange={e => setFormData({...formData, remark: e.target.value})} />
                            </div>

                            <button disabled={loading} className="w-full bg-[#003781] hover:bg-[#002860] text-white py-4 rounded-xl font-bold text-lg shadow-lg transition-all mt-4 active:scale-95 flex items-center justify-center gap-3">
                                {loading ? 'กำลังบันทึก...' : <><CheckCircle size={24}/> ยืนยันสิทธิ์</>}
                            </button>
                        </form>
                    </div>
                </div>
             </div>
        </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 flex flex-col w-full overflow-x-hidden max-w-[100vw]">
      
      <ImageModal />
      {renderCheckOrderModal()} 
      {renderOrderModal()}
      {renderSuccessModal()} 

      {/* Navbar (FIXED TOP) */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md border-b border-[#003781]/10 h-[70px] md:h-[80px]">
        <div className="w-full max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          <div onClick={() => setView('home')} className="cursor-pointer flex items-center gap-3">
             <div className="bg-blue-50 p-2 rounded-xl border border-blue-100 hidden md:block">
                 <Gift className="text-[#003781]" size={32}/>
             </div>
             <div className="md:hidden">
                 <Gift className="text-[#003781]" size={28}/>
             </div>
             
             <div className="flex flex-col leading-none">
                <span className="text-[#003781] font-extrabold text-xl md:text-2xl tracking-tight uppercase">Allianz</span>
                <span className="text-gray-400 font-bold text-[10px] md:text-xs tracking-widest uppercase mt-0.5">Privilege Gift 2025</span>
             </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            {view === 'home' && (
                <button onClick={() => setIsCheckOrderOpen(true)} className="flex items-center gap-2 text-xs md:text-sm font-bold text-[#003781] bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition border border-blue-100 shadow-sm">
                    <Truck size={18}/> 
                    <span>ตรวจสอบสถานะ</span>
                </button>
            )}
            
            {view !== 'admin' && view !== 'login' && (
                <button onClick={() => setView('login')} className="text-gray-300 hover:text-[#003781] p-2 transition-colors">
                  <Lock size={20} /> 
                </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow w-full py-6 mt-[70px] md:mt-[80px]">
        <div className="w-full max-w-7xl mx-auto px-4 md:px-6">
        
        {/* VIEW: HOME */}
        {view === 'home' && (
           <div className="animate-fade-in w-full overflow-hidden">
             {bannerSettings.showAnnouncement && bannerSettings.announcementText && (
                <div className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white text-center py-2 px-4 text-xs md:text-sm font-bold relative rounded-lg shadow-sm mb-4 flex justify-center items-center gap-2">
                    <Megaphone size={16} className="animate-pulse hidden md:block"/>
                    <span>{bannerSettings.announcementText}</span>
                </div>
            )}

            {/* Banner */}
            <div className="relative w-full aspect-[21/9] min-h-[220px] max-h-[400px] rounded-2xl overflow-hidden shadow-xl mb-6 group bg-gray-200">
               {!isBannerLoaded && (
                   <div className="absolute inset-0 flex items-center justify-center text-gray-400 animate-pulse">
                       <Package size={48} />
                   </div>
               )}
               <img 
                 src={bannerSettings.bannerUrl || "https://images.unsplash.com/photo-1513201099705-a9746e1e201f?w=2000"} 
                 className={`w-full h-full object-cover transition-opacity duration-700 hover:scale-105 ${isBannerLoaded ? 'opacity-100' : 'opacity-0'}`} 
                 onLoad={() => setIsBannerLoaded(true)}
                 alt="Banner"
               />
              <div className="absolute inset-0 bg-gradient-to-r from-[#003781]/90 via-[#003781]/60 to-transparent flex items-center p-6 md:p-12">
                 <div className="text-white w-full max-w-xl">
                    <span className="bg-white/20 backdrop-blur text-xs md:text-sm px-3 py-1 rounded-full mb-3 inline-block border border-white/30 shadow-sm text-yellow-300 font-bold">
                      {bannerSettings.subtitle} 
                    </span>
                    <h1 className="text-2xl md:text-5xl lg:text-6xl font-extrabold mb-4 leading-tight drop-shadow-lg whitespace-pre-line break-words text-white">
                      {bannerSettings.title} 
                    </h1>
                    <button onClick={() => document.getElementById('products-grid')?.scrollIntoView({behavior:'smooth'})} className="bg-white text-[#003781] px-5 py-2 md:px-6 md:py-3 rounded-xl text-sm md:text-base font-bold shadow-lg hover:bg-blue-50 transition active:scale-95 flex items-center gap-2">
                      เลือกของขวัญ <ChevronRight size={18}/>
                    </button>
                 </div>
              </div>
            </div>

            {/* Filter Categories (DYNAMIC) */}
            <div id="products-grid" className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                   <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2"><ShoppingBag className="text-[#003781]"/> เลือกของขวัญ 1 ชิ้น</h2>
                </div>
                
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    <button 
                        onClick={() => setSelectedCategory("ทั้งหมด")}
                        className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all border ${selectedCategory === "ทั้งหมด" ? 'bg-[#003781] text-white border-[#003781] shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                    >
                        ทั้งหมด
                    </button>
                    {categories.filter(c => c.active).map((cat) => (
                        <button 
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.name)}
                            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all border ${selectedCategory === cat.name ? 'bg-[#003781] text-white border-[#003781] shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid System */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 w-full pb-10">
              {getFilteredProducts().filter(p => p.active).map((p) => {
                const isOutOfStock = (p.stock || 0) <= 0;
                return (
                  <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl transition-all group flex flex-col w-full relative h-full">
                    {p.isNew && (
                        <div className="absolute top-2 left-2 z-10 bg-red-600 text-white text-[10px] md:text-xs font-bold px-2 py-1 rounded shadow-md flex items-center gap-1">
                            <Tag size={12}/> New
                        </div>
                    )}
                    <div className="aspect-[4/3] w-full overflow-hidden relative bg-gray-100 cursor-zoom-in" onClick={() => setViewingImage(p.imageUrl)}>
                      <img src={p.imageUrl} className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${isOutOfStock ? 'grayscale opacity-70' : ''}`}/> 
                      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ZoomIn className="text-white drop-shadow-md" size={32}/>
                      </div>
                      {isOutOfStock && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <span className="bg-black/70 text-white px-3 py-1 rounded-lg text-sm font-bold">สินค้าหมด</span>
                          </div>
                      )}
                    </div>
                    <div className="p-3 md:p-4 flex flex-col flex-grow">
                      <div className="text-[10px] text-gray-400 mb-1 font-mono uppercase tracking-wide flex justify-between">
                          <span>{p.code || '-'}</span>
                          <span className="text-[#003781] font-bold">{p.category}</span>
                      </div>
                      <h3 className="font-bold text-sm md:text-base text-gray-900 mb-1 line-clamp-1">{p.name}</h3>
                      <p className="text-gray-500 text-xs mb-2 flex-grow line-clamp-2">{p.description}</p>
                      <div className="flex justify-between items-center mb-3">
                         <span className={`text-xs font-bold ${isOutOfStock ? 'text-red-500' : 'text-green-600'}`}>
                             {isOutOfStock ? 'หมดแล้ว' : `เหลือ ${p.stock} ชิ้น`}
                         </span>
                      </div>
                      <button 
                        disabled={isOutOfStock}
                        onClick={() => { setSelectedProduct(p); setSelectedOption(''); setDeliveryMethod('delivery'); setFormData({ name: '', phone: '', address: '', pickupDate: '', remark: '' }); setIsOrderModalOpen(true); }} 
                        className={`w-full py-2 rounded-lg font-bold text-xs md:text-sm shadow-md transition-all active:scale-95 ${isOutOfStock ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#003781] text-white hover:bg-[#002860]'}`}
                      >
                        {isOutOfStock ? 'สินค้าหมด' : 'แลกรับสิทธิ์'}
                      </button> 
                    </div>
                  </div>
                );
              })}
              {getFilteredProducts().filter(p => p.active).length === 0 && (
                  <div className="col-span-full py-12 text-center text-gray-400">
                      <Package size={48} className="mx-auto mb-2 opacity-30"/>
                      <p>ไม่มีสินค้าในหมวดหมู่นี้</p>
                  </div>
              )}
            </div>
           </div>
        )}

        {/* VIEW: LOGIN */}
        {view === 'login' && (
          <div className="max-w-sm mx-auto mt-10 p-8 bg-white rounded-2xl shadow-xl border border-gray-100 text-center">
             <div className="mb-6 flex justify-center text-[#003781]"><Lock size={48}/></div>
             <h2 className="text-2xl font-bold text-gray-900 mb-6">ผู้ดูแลระบบ</h2>
             <form onSubmit={handleLogin} className="space-y-4">
               <input type="password" autoFocus className="w-full px-4 py-3 text-center text-xl tracking-widest border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#003781] outline-none text-gray-900" placeholder="รหัสผ่าน" value={adminPassInput} onChange={e => setAdminPassInput(e.target.value)} />
               <button className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-black transition">เข้าสู่ระบบ</button> 
               <div onClick={() => setView('home')} className="text-sm text-gray-400 cursor-pointer hover:underline mt-4">กลับหน้าหลัก</div>
             </form>
          </div>
        )}

        {/* VIEW: ADMIN DASHBOARD */}
        {view === 'admin' && (
          <div className="animate-fade-in w-full">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
               <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-gray-900"><Database className="text-[#003781]"/> ระบบหลังบ้าน</h2>
               <div className="flex gap-2 w-full md:w-auto">
                 <button onClick={() => setView('home')} className="flex-1 md:flex-none justify-center px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200 whitespace-nowrap">ดูหน้าเว็บ</button>
                 <button onClick={() => setView('home')} className="flex-1 md:flex-none justify-center px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg flex items-center gap-2 whitespace-nowrap"><LogOut size={16}/> ออก</button>
               </div>
             </div>
             
             {/* Stats */}
             <div className="grid grid-cols-3 gap-2 md:gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center">
                    <span className="text-gray-500 text-xs md:text-sm font-bold">ออเดอร์ทั้งหมด</span>
                    <span className="text-2xl md:text-3xl font-bold text-[#003781]">{stats.total}</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-orange-200 shadow-sm flex flex-col items-center bg-orange-50">
                    <span className="text-orange-600 text-xs md:text-sm font-bold">รอดำเนินการ</span>
                    <span className="text-2xl md:text-3xl font-bold text-orange-600">{stats.pending}</span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-green-200 shadow-sm flex flex-col items-center bg-green-50">
                    <span className="text-green-600 text-xs md:text-sm font-bold">เสร็จสิ้นแล้ว</span>
                    <span className="text-2xl md:text-3xl font-bold text-green-600">{stats.completed}</span>
                </div>
             </div>

             <div className="flex gap-2 mb-6 border-b overflow-x-auto pb-1 no-scrollbar w-full">
               <button onClick={() => setAdminTab('orders')} className={`px-4 py-2 rounded-t-lg font-bold whitespace-nowrap text-sm md:text-base ${adminTab === 'orders' ? 'bg-[#003781] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>📦 ออเดอร์ ({orders.length})</button> 
               <button onClick={() => setAdminTab('products')} className={`px-4 py-2 rounded-t-lg font-bold whitespace-nowrap text-sm md:text-base ${adminTab === 'products' ? 'bg-[#003781] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>🛍️ สินค้า</button>
               {/* NEW TAB CATEGORIES */}
               <button onClick={() => setAdminTab('categories')} className={`px-4 py-2 rounded-t-lg font-bold whitespace-nowrap text-sm md:text-base ${adminTab === 'categories' ? 'bg-[#003781] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>📂 หมวดหมู่</button>
               <button onClick={() => setAdminTab('settings')} className={`px-4 py-2 rounded-t-lg font-bold whitespace-nowrap text-sm md:text-base ${adminTab === 'settings' ? 'bg-[#003781] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>🖼️ ตั้งค่าเว็บ</button>
             </div>
             
             <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 min-h-[400px] w-full">
               
               {/* TAB: ORDERS */}
               {adminTab === 'orders' && (
                 <div className="w-full">
                    <div className="flex flex-col md:flex-row gap-4 mb-4 justify-between items-center bg-gray-50 p-3 rounded-lg border">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                            <input className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="ค้นหาชื่อ, เบอร์โทร, รหัสสินค้า..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                        </div>
                        <button onClick={exportToCSV} className="w-full md:w-auto flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow transition"><Download size={18}/> Export Excel</button>
                    </div>

                    {/* EDIT ORDER MODAL */}
                    {editingOrder && (
                      <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
                          <div className="flex justify-between mb-4"><h3 className="text-xl font-bold flex items-center gap-2"><Edit size={20} className="text-[#003781]"/> แก้ไขข้อมูลออเดอร์</h3><button onClick={() => setEditingOrder(null)}><X className="text-gray-400 hover:text-red-500"/></button></div>
                          <form onSubmit={handleSaveOrder} className="space-y-4">
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <h4 className="text-sm font-bold text-gray-700 mb-2">ข้อมูลลูกค้า</h4>
                                <div className="space-y-3">
                                    <div><label className="text-xs text-gray-500 font-bold">ชื่อลูกค้า</label><input required className="w-full p-2 border rounded text-gray-900 bg-white" value={editingOrder.name} onChange={e => setEditingOrder({...editingOrder, name: e.target.value})} /></div>
                                    <div><label className="text-xs text-gray-500 font-bold">เบอร์โทร</label><input required className="w-full p-2 border rounded text-gray-900 bg-white" value={editingOrder.phone} onChange={e => setEditingOrder({...editingOrder, phone: e.target.value})} /></div>
                                </div>
                            </div>
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                 <h4 className="text-sm font-bold text-[#003781] mb-2">การจัดส่ง & สถานะ</h4>
                                 <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-gray-500 font-bold">วิธีรับของ</label>
                                            <select className="w-full p-2 border rounded text-gray-900 bg-white" value={editingOrder.deliveryMethod} onChange={e => setEditingOrder({...editingOrder, deliveryMethod: e.target.value})}>
                                                <option value="จัดส่งถึงบ้าน">จัดส่งถึงบ้าน</option>
                                                <option value="นัดรับ">นัดรับ</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 font-bold">สถานะ</label>
                                            <select className="w-full p-2 border rounded text-gray-900 bg-white" value={editingOrder.status} onChange={e => setEditingOrder({...editingOrder, status: e.target.value})}>
                                                <option value="pending">รอดำเนินการ</option>
                                                <option value="confirmed_date">ยืนยันวันเวลา</option>
                                                <option value="completed">เสร็จสิ้น/ส่งแล้ว</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 font-bold flex items-center gap-1"><Truck size={12}/> เลขพัสดุ (Tracking)</label>
                                        <input className="w-full p-2 border rounded text-gray-900 bg-white placeholder-gray-400" placeholder="เช่น Kerry: KER123..." value={editingOrder.trackingNumber || ''} onChange={e => setEditingOrder({...editingOrder, trackingNumber: e.target.value})} />
                                    </div>
                                    <div><label className="text-xs text-gray-500 font-bold">ที่อยู่ / จุดนัดรับ</label><textarea required rows={3} className="w-full p-2 border rounded text-gray-900 bg-white" value={editingOrder.address} onChange={e => setEditingOrder({...editingOrder, address: e.target.value})} /></div>
                                    <div>
                                        <label className="text-xs text-gray-500 font-bold text-orange-600">เวลานัดรับ</label>
                                        <input type="datetime-local" className="w-full p-2 border rounded text-gray-900 bg-white" value={editingOrder.pickupDate || ''} onChange={e => setEditingOrder({...editingOrder, pickupDate: e.target.value})} />
                                    </div>
                                 </div>
                            </div>
                            <div className="pt-2 flex gap-3"><button type="submit" className="flex-1 bg-[#003781] text-white py-2 rounded-lg font-bold">บันทึก</button></div>
                          </form>
                        </div>
                      </div>
                    )}

                   <div className="overflow-x-auto w-full">
                     <table className="w-full text-left text-sm min-w-[900px]">
                       <thead className="bg-gray-50 text-gray-700 font-bold border-b">
                         <tr>
                           <th className="p-3 w-10 text-center">สถานะ</th>
                           <th className="p-3 w-28">วันที่</th>
                           <th className="p-3 w-24">ประเภท</th>
                           <th className="p-3 w-36">ลูกค้า</th>
                           <th className="p-3 w-28">เบอร์โทร</th>
                           <th className="p-3 w-40">สินค้า (Code)</th>
                           <th className="p-3">ที่อยู่ / นัดรับ</th>
                           <th className="p-3 w-20 text-center">Action</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y">
                         {filteredOrders.map((order) => {
                           const isCompleted = order.status === 'completed';
                           const isConfirmedDate = order.status === 'confirmed_date';
                           return (
                           <tr key={order.id} className={`hover:bg-gray-50 text-gray-800 ${isCompleted ? 'bg-gray-50/50' : ''}`}>
                             <td className="p-3 text-center">
                                <button onClick={() => handleToggleStatus(order)} 
                                    title={isCompleted ? "เสร็จสิ้น" : (isConfirmedDate ? "ยืนยันวันแล้ว" : "รอดำเนินการ")} 
                                    className={`transition-all ${isCompleted ? 'text-green-500' : (isConfirmedDate ? 'text-emerald-500' : 'text-gray-300 hover:text-green-400')}`}
                                >
                                    {isCompleted ? <CheckSquare size={24}/> : (isConfirmedDate ? <CalendarCheck size={24}/> : <div className="w-6 h-6 border-2 border-gray-300 rounded hover:border-green-400"></div>)}
                                </button>
                             </td>
                             <td className="p-3 text-gray-500 whitespace-nowrap text-xs">{order.timestamp?.toDate().toLocaleDateString('th-TH')}<div className="text-[10px] opacity-70">{order.timestamp?.toDate().toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}</div></td>
                             <td className="p-3"><span className={`px-2 py-1 rounded text-[10px] font-bold ${order.deliveryMethod === 'นัดรับ' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{order.deliveryMethod || 'จัดส่ง'}</span></td>
                             <td className="p-3 font-medium text-[#003781]">{order.name}</td>
                             <td className="p-3 text-gray-600">{order.phone}</td>
                             <td className="p-3">
                                 <div className="font-bold text-gray-800">{order.product}</div>
                                 {order.productOption && order.productOption !== '-' && <div className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded w-fit my-1 border border-yellow-200">{order.productOption}</div>}
                                 <div className="text-[10px] text-gray-400 font-mono">Code: {order.productCode}</div>
                             </td>
                             <td className="p-3 text-gray-600 min-w-[200px] text-xs">
                                {order.address}
                                {order.remark && <div className="text-gray-400 italic mt-1">Note: {order.remark}</div>}
                                {order.pickupDate && <div className={`mt-1 font-bold flex items-center gap-1 ${isConfirmedDate ? 'text-emerald-600' : 'text-orange-600'}`}><Clock size={10}/> นัด: {new Date(order.pickupDate).toLocaleString('th-TH')}</div>}
                                {order.trackingNumber && <div className="mt-1 text-blue-600 font-mono bg-blue-50 px-1 rounded w-fit">📦 {order.trackingNumber}</div>}
                             </td>
                             <td className="p-3 text-center flex gap-1 justify-center">
                               <button onClick={() => setEditingOrder(order)} className="p-1.5 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"><Edit size={14}/></button>
                               <button onClick={() => handleDeleteOrder(order.id)} className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200"><Trash2 size={14}/></button>
                             </td>
                           </tr>
                         )})}
                       </tbody>
                     </table>
                     {filteredOrders.length === 0 && <div className="p-10 text-center text-gray-400 flex flex-col items-center gap-2"><Package size={40}/> ไม่พบข้อมูลออเดอร์</div>} 
                   </div>
                 </div>
               )}

               {/* TAB: PRODUCTS */}
               {adminTab === 'products' && (
                 <div>
                    <div className="flex flex-col md:flex-row justify-between mb-4 gap-3">
                      <h3 className="font-bold text-lg">จัดการสินค้า</h3>
                      <button onClick={() => setEditingProduct({})} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-green-700 w-full md:w-auto">
                         <Plus size={16}/> เพิ่มสินค้าใหม่
                      </button>
                    </div>

                    {editingProduct && (
                      <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
                           <div className="flex justify-between mb-4"><h3 className="text-xl font-bold">{editingProduct.id ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h3><button onClick={() => setEditingProduct(null)}><X className="text-gray-400 hover:text-red-500"/></button></div>
                          <form onSubmit={handleSaveProduct} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs text-gray-500 font-bold">รหัสสินค้า</label><input required className="w-full p-2 border rounded text-gray-900 bg-gray-50" placeholder="เช่น ABC-001" value={editingProduct.code || ''} onChange={e => setEditingProduct({...editingProduct, code: e.target.value})} /></div>
                                <div><label className="text-xs text-gray-500 font-bold">จำนวนสต็อก</label><input required type="number" className="w-full p-2 border rounded text-gray-900 bg-gray-50" placeholder="0" value={editingProduct.stock || 0} onChange={e => setEditingProduct({...editingProduct, stock: e.target.value})} /></div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 font-bold">หมวดหมู่ (Category)</label>
                                <div className="flex gap-2">
                                    {/* DYNAMIC CATEGORY DROPDOWN */}
                                    <select className="flex-1 p-2 border rounded text-gray-900 bg-white" value={editingProduct.category || categories[0]?.name || ''} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}>
                                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div><label className="text-xs text-gray-500 font-bold">ชื่อสินค้า</label><input required className="w-full p-2 border rounded text-gray-900" value={editingProduct.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} /></div>
                            <div><label className="text-xs text-gray-500 font-bold">รายละเอียด</label><input required className="w-full p-2 border rounded text-gray-900" value={editingProduct.description || ''} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} /></div>
                            <div>
                                <label className="text-xs text-gray-500 font-bold flex items-center gap-1"><Layers size={12}/> ตัวเลือกสินค้า (ถ้ามี)</label>
                                <input className="w-full p-2 border rounded text-gray-900 bg-yellow-50" placeholder="เช่น: สีแดง, สีน้ำเงิน, S, M, L" value={editingProduct.optionsString || ''} onChange={e => setEditingProduct({...editingProduct, optionsString: e.target.value})} />
                            </div>
                            <div className="border p-3 rounded-lg bg-gray-50">
                                <label className="text-xs text-gray-500 font-bold mb-2 block">รูปสินค้า</label>
                                <input type="file" accept="image/*" onChange={handleProductImageUpload} className="w-full mb-2 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700"/>
                                <input className="w-full p-2 border rounded text-gray-900 text-sm" placeholder="วางลิงก์รูปภาพ (URL)" value={editingProduct.imageUrl || ''} onChange={e => setEditingProduct({...editingProduct, imageUrl: e.target.value})} />
                                {editingProduct.imageUrl && <div className="mt-2 text-center"><img src={editingProduct.imageUrl} className="h-20 mx-auto rounded border bg-white object-contain"/></div>}
                            </div>
                            <div className="flex items-center gap-2"><input type="checkbox" id="isNew" className="w-4 h-4" checked={editingProduct.isNew || false} onChange={e => setEditingProduct({...editingProduct, isNew: e.target.checked})}/><label htmlFor="isNew" className="text-sm text-gray-700">แสดงป้าย <span className="text-red-500 font-bold">New Arrival</span></label></div>
                            <div className="pt-2 flex gap-3"><button type="submit" className="flex-1 bg-[#003781] text-white py-3 rounded-lg font-bold shadow-lg hover:bg-[#002860]">บันทึกข้อมูล</button></div>
                          </form>
                        </div>
                    </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {products.map(p => (
                        <div key={p.id} className={`border rounded-xl p-4 flex gap-4 items-start relative ${!p.active ? 'opacity-60 bg-gray-100' : 'bg-white'}`}>
                          {p.isNew && <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] px-1.5 rounded">New</span>}
                          <img src={p.imageUrl} className="w-20 h-20 rounded object-cover bg-gray-200 flex-shrink-0 border"/>
                          <div className="flex-grow min-w-0">
                            <div className="flex justify-between items-start">
                                <div className="font-bold text-gray-900 truncate">{p.name}</div>
                                <div className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{p.category}</div>
                            </div>
                            <div className="text-xs font-mono text-gray-400 mb-1">{p.code}</div>
                            <div className="text-xs text-gray-500 mb-1 truncate">{p.description}</div>
                            {p.options && p.options.length > 0 && <div className="text-[10px] text-gray-500 bg-gray-50 border rounded px-1 py-0.5 inline-block mb-1">ตัวเลือก: {p.options.join(', ')}</div>}
                            <div className="text-xs font-bold mb-2 text-blue-600">Stock: {p.stock}</div>
                            <div className="flex gap-2">
                               <button onClick={() => handleToggleProduct(p)} className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${p.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>{p.active ? <><Eye size={12}/> แสดง</> : <><EyeOff size={12}/> ซ่อน</>}</button>
                               <button onClick={() => openEditProduct(p)} className="px-2 py-1 bg-blue-50 rounded text-xs text-blue-600 flex items-center gap-1"><Edit size={12}/> แก้ไข</button>
                               <button onClick={() => handleDeleteProduct(p.id)} className="px-2 py-1 bg-red-50 rounded text-xs text-red-600 flex items-center gap-1"><Trash2 size={12}/> ลบ</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                 </div>
               )}

               {/* TAB: CATEGORIES (NEW) */}
               {adminTab === 'categories' && (
                   <div className="max-w-2xl">
                       <h3 className="font-bold text-lg mb-4">จัดการหมวดหมู่สินค้า</h3>
                       
                       <form onSubmit={handleAddCategory} className="flex gap-2 mb-6 bg-gray-50 p-4 rounded-xl border">
                           <input 
                               className="flex-1 p-2 border rounded-lg text-gray-900 focus:ring-2 focus:ring-[#003781] outline-none" 
                               placeholder="ชื่อหมวดหมู่ใหม่ (เช่น Seasonal, Clearance)"
                               value={newCategoryName}
                               onChange={e => setNewCategoryName(e.target.value)}
                           />
                           <button className="bg-[#003781] text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-[#002860]">
                               <Plus size={18}/> เพิ่ม
                           </button>
                       </form>

                       <div className="space-y-2">
                           {categories.map((cat) => (
                               <div key={cat.id} className="flex items-center justify-between p-3 border rounded-lg bg-white hover:bg-gray-50 transition">
                                   <div className="flex items-center gap-3">
                                       <Folder className="text-yellow-500" size={20}/>
                                       <span className={`font-bold ${!cat.active ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{cat.name}</span>
                                   </div>
                                   <div className="flex gap-2">
                                       <button 
                                           onClick={() => handleToggleCategory(cat)}
                                           className={`p-2 rounded-lg transition-colors ${cat.active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}
                                           title={cat.active ? 'กำลังแสดง' : 'ถูกซ่อน'}
                                       >
                                           <Power size={18}/>
                                       </button>
                                       <button 
                                           onClick={() => handleDeleteCategory(cat.id)}
                                           className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                           title="ลบหมวดหมู่"
                                       >
                                           <Trash2 size={18}/>
                                       </button>
                                   </div>
                               </div>
                           ))}
                       </div>
                   </div>
               )}

               {/* TAB: SETTINGS */}
               {adminTab === 'settings' && (
                 <div className="max-w-xl">
                   <h3 className="font-bold text-lg mb-4 border-b pb-2">ตั้งค่าหน้าเว็บ</h3>
                   <div className="space-y-4">
                     <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                        <label className="text-sm font-bold text-gray-800 mb-2 block flex items-center gap-2">
                           <Megaphone size={16}/> แถบประกาศด้านบน (Top Bar)
                        </label>
                        <div className="flex items-center gap-2 mb-2">
                            <input type="checkbox" checked={bannerSettings.showAnnouncement} onChange={e => setBannerSettings({...bannerSettings, showAnnouncement: e.target.checked})} className="w-4 h-4"/>
                            <span className="text-sm">แสดงแถบประกาศ</span>
                        </div>
                        <input className="w-full p-2 border rounded-lg text-gray-900 text-sm" placeholder="ใส่ข้อความประกาศ..." value={bannerSettings.announcementText} onChange={e => setBannerSettings({...bannerSettings, announcementText: e.target.value})} />
                     </div>
                     <div><label className="block text-sm font-bold text-gray-700 mb-1">หัวข้อหลัก (Banner Title)</label><textarea rows={2} className="w-full p-3 border rounded-xl text-gray-900" value={bannerSettings.title} onChange={e => setBannerSettings({...bannerSettings, title: e.target.value})} /></div>
                     <div><label className="block text-sm font-bold text-gray-700 mb-1">ข้อความรอง (Subtitle / Badge)</label><input className="w-full p-3 border rounded-xl text-gray-900" value={bannerSettings.subtitle} onChange={e => setBannerSettings({...bannerSettings, subtitle: e.target.value})} /></div>
                     
                     <div className="border p-4 rounded-xl bg-gray-50">
                        <label className="block text-sm font-bold text-gray-700 mb-2">รูปแบนเนอร์ (Banner Image)</label>
                        <input type="file" accept="image/*" onChange={handleBannerImageUpload} className="w-full mb-3 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition"/>
                        <input className="w-full p-3 border rounded-xl text-gray-900 text-sm" placeholder="หรือใส่ URL รูปภาพ..." value={bannerSettings.bannerUrl} onChange={e => setBannerSettings({...bannerSettings, bannerUrl: e.target.value})} />
                        {bannerSettings.bannerUrl && (
                            <div className="mt-3 rounded-lg overflow-hidden border">
                                <img src={bannerSettings.bannerUrl} className="w-full h-32 object-cover"/>
                            </div>
                        )}
                     </div>

                     <button onClick={handleSaveBanner} className="bg-[#003781] hover:bg-[#002860] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all w-full justify-center md:w-auto"><Save size={18}/> บันทึกการตั้งค่า</button>
                   </div>
                 </div>
               )}

             </div>
          </div>
        )}

        </div>
      </div>
      <Footer />
    </div>
  );
}