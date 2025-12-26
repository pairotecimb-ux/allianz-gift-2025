import { useState, useEffect } from 'react';
import { ShoppingBag, CheckCircle, ArrowLeft, Lock, Database, Edit, Trash2, Plus, Eye, EyeOff, Save, LogOut, X, Package, MapPin, Phone, User, Truck, Handshake, MessageCircle, Calendar, Receipt, FileText, ZoomIn, Tag, AlertCircle } from 'lucide-react';
import { db } from './firebase'; 
import { collection, addDoc, getDocs, orderBy, query, Timestamp, doc, updateDoc, deleteDoc, setDoc, getDoc } from 'firebase/firestore';

// --- รหัสผ่านเข้าหลังบ้าน ---
const ADMIN_PASSWORD = "8787"; 

// --- ข้อมูลสินค้าเริ่มต้น (เพิ่ม field ใหม่) ---
const INITIAL_PRODUCTS = [
  { id: '1', code: "BAG-001", name: "กระเป๋าเดินทาง 20 นิ้ว", description: "สี Midnight Blue (Limited)", imageUrl: "https://images.unsplash.com/photo-1565026057447-bc072a804e8f?w=1000", active: true, isNew: true, stock: 10 },
  { id: '2', code: "SHIRT-L", name: "เสื้อฮาวายลายช้าง (L)", description: "ผ้าไหมอิตาลี ใส่สบาย", imageUrl: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=1000", active: true, isNew: false, stock: 5 },
  { id: '3', code: "GIFT-SET", name: "ชุด Gift Set รักษ์โลก", description: "แก้วน้ำ + ถุงผ้า", imageUrl: "https://images.unsplash.com/photo-1542435503-956c469947f6?w=1000", active: true, isNew: true, stock: 0 },
];

export default function App() {
  // --- States ---
  const [view, setView] = useState('home'); 
  const [products, setProducts] = useState<any[]>([]); 
  
  // Banner Settings
  const [bannerSettings, setBannerSettings] = useState({
    bannerUrl: "https://images.unsplash.com/photo-1549417229-aa67d3263c09?w=2000",
    title: "ของขวัญพิเศษ แทนคำขอบคุณ",
    subtitle: "Privilege 2025"
  });

  const [selectedProduct, setSelectedProduct] = useState<any>(null); 
  const [viewingImage, setViewingImage] = useState<string | null>(null); // State สำหรับดูรูปใหญ่
  const [loading, setLoading] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery');
  
  const [formData, setFormData] = useState({ name: '', phone: '', address: '', pickupDate: '', remark: '' }); 
  const [finalDeliveryMethod, setFinalDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery'); 
  
  // Admin States
  const [orders, setOrders] = useState<any[]>([]);
  const [adminPassInput, setAdminPassInput] = useState(''); 
  const [adminTab, setAdminTab] = useState('orders'); 
  const [editingProduct, setEditingProduct] = useState<any>(null); 
  const [editingOrder, setEditingOrder] = useState<any>(null);

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

  const fetchContent = async () => {
    setLoading(true);
    try {
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

      const settingSnap = await getDoc(doc(db, "settings", "main"));
      if (settingSnap.exists()) {
        const data = settingSnap.data();
        setBannerSettings({
          bannerUrl: data.bannerUrl || bannerSettings.bannerUrl,
          title: data.title || bannerSettings.title,
          subtitle: data.subtitle || bannerSettings.subtitle
        }); 
      } else {
        await setDoc(doc(db, "settings", "main"), bannerSettings);
      }

    } catch (err) {
      console.error("Error fetching:", err);
    }
    setLoading(false); 
  };

// --- Function แปลงไฟล์รูป + ย่อรูปอัตโนมัติ (แก้ปัญหาไฟล์ใหญ่เกิน) ---
const handleImageUpload = (e: any) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event: any) => {
      const img = new Image();
      img.onload = () => {
        // สร้าง Canvas เพื่อย่อรูป
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // กำหนดขนาดสูงสุด (เช่นกว้างไม่เกิน 800px ก็พอชัดแล้วครับ)
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

        // แปลงเป็น Base64 แบบบีบอัด (JPEG quality 0.7) เพื่อให้ไฟล์เล็กจิ๋ว
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setEditingProduct({ ...editingProduct, imageUrl: dataUrl });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }
};

  // --- 2. ฟังก์ชันลูกค้า ---
  const handleSubmitOrder = async (e: any) => {
    e.preventDefault();
    setLoading(true); 
    try {
        // เช็คสต็อกอีกรอบก่อนบันทึก
        const productRef = doc(db, "products", selectedProduct.id);
        const productSnap = await getDoc(productRef);
        
        if (productSnap.exists()) {
            const currentStock = productSnap.data().stock || 0;
            if (currentStock <= 0) {
                alert("เสียใจด้วย สินค้าชิ้นนี้หมดพอดีครับ");
                setLoading(false);
                setView('home');
                fetchContent(); // รีเฟรชข้อมูล
                return;
            }

            // 1. บันทึกออเดอร์
            await addDoc(collection(db, "orders"), {
                ...formData,
                deliveryMethod: deliveryMethod === 'delivery' ? 'จัดส่งถึงบ้าน' : 'นัดรับ', 
                product: selectedProduct.name,
                productId: selectedProduct.id,
                productCode: selectedProduct.code || '-',
                timestamp: Timestamp.now(),
                status: 'pending'
            });

            // 2. ตัดสต็อก
            await updateDoc(productRef, {
                stock: currentStock - 1
            });

            setFinalDeliveryMethod(deliveryMethod); 
            setLoading(false);
            setView('success');
            fetchContent(); // อัปเดตหน้าสินค้าใหม่ให้สต็อกลดลง
        }
    } catch (error: any) {
      alert("เกิดข้อผิดพลาด: " + error.message);
      setLoading(false);
    }
  };

  // --- 3. ฟังก์ชัน Admin ---
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
    setOrders(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const handleSaveProduct = async (e: any) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      // แปลง stock เป็น number
      const productData = {
          ...editingProduct,
          stock: parseInt(editingProduct.stock) || 0,
          code: editingProduct.code || '',
          isNew: editingProduct.isNew || false
      };

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
      await updateDoc(doc(db, "orders", id), data); 
      setEditingOrder(null);
      fetchOrders();
    } catch (err: any) { alert("บันทึกออเดอร์ไม่สำเร็จ: " + err.message); }
  };

  const handleSaveBanner = async () => {
    await setDoc(doc(db, "settings", "main"), bannerSettings); 
    alert("บันทึกการตั้งค่าหน้าเว็บเรียบร้อย");
  };

  const Footer = () => (
    <footer className="w-full bg-white border-t border-gray-200 py-6 text-center mt-auto">
      <div className="container mx-auto px-4">
        <p className="text-gray-600 text-sm md:text-base">
          © 2025 Allianz Ayudhya. สงวนสิทธิ์ 1 ท่านต่อ 1 สิทธิ์ <br/>
          <span className="text-xs text-gray-400">Campaign by นัท อลิอันซ์ v5.0 (Ultimate)</span> 
        </p>
      </div>
    </footer>
  ); 

  // --- Component: Image Modal (ดูรูปใหญ่) ---
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

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 flex flex-col w-full overflow-x-hidden max-w-[100vw]">
      
      <ImageModal />

      {/* Navbar */}
      <div className="bg-white shadow-sm sticky top-0 z-50 w-full">
        <div className="w-full max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div onClick={() => setView('home')} className="cursor-pointer text-[#003781] font-bold text-xl md:text-2xl flex items-center gap-2">
            Allianz <span className="text-gray-400 font-light">Ayudhya</span> 
          </div>
          {view !== 'admin' && view !== 'login' && (
            <button onClick={() => setView('login')} className="text-gray-300 hover:text-[#003781] p-2">
              <Lock size={20} /> 
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow w-full py-6">
        <div className="w-full max-w-7xl mx-auto px-4 md:px-6">
        
        {/* VIEW: HOME */}
        {view === 'home' && (
           <div className="animate-fade-in w-full overflow-hidden">
            {/* Banner */}
            <div className="relative w-full aspect-[21/9] min-h-[200px] max-h-[400px] rounded-2xl overflow-hidden shadow-xl mb-8 md:mb-12 group">
              <img src={bannerSettings.bannerUrl} className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" alt="Banner"/>
              <div className="absolute inset-0 bg-gradient-to-r from-[#003781]/95 via-[#003781]/70 to-transparent flex items-center p-6 md:p-12">
                 <div className="text-white w-full max-w-xl">
                    <span className="bg-white/20 backdrop-blur text-xs md:text-sm px-3 py-1 rounded-full mb-3 inline-block border border-white/30 shadow-sm">
                      {bannerSettings.subtitle} 
                    </span>
                    <h1 className="text-xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight drop-shadow-lg whitespace-pre-line break-words">
                      {bannerSettings.title} 
                    </h1>
                    <button onClick={() => document.getElementById('products-grid')?.scrollIntoView({behavior:'smooth'})} className="bg-white text-[#003781] px-5 py-2 md:px-6 md:py-3 rounded-xl text-sm md:text-base font-bold shadow-lg hover:bg-blue-50 transition active:scale-95">
                      เลือกของขวัญ
                    </button>
                 </div>
              </div>
            </div>

            <div id="products-grid" className="mb-6 flex items-center gap-2 text-xl md:text-2xl font-bold text-gray-800">
               <ShoppingBag className="text-[#003781]"/> เลือกของขวัญ 1 ชิ้น
            </div>

            {/* Grid System */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-8 w-full">
              {products.filter(p => p.active).map((p) => {
                const isOutOfStock = (p.stock || 0) <= 0;
                return (
                  <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl transition-all group flex flex-col w-full relative">
                    
                    {/* Badge: New Arrival */}
                    {p.isNew && (
                        <div className="absolute top-2 left-2 z-10 bg-red-600 text-white text-[10px] md:text-xs font-bold px-2 py-1 rounded shadow-md flex items-center gap-1">
                            <Tag size={12}/> New Arrival
                        </div>
                    )}

                    {/* Image Area */}
                    <div className="aspect-[4/3] w-full overflow-hidden relative bg-gray-100 cursor-zoom-in" onClick={() => setViewingImage(p.imageUrl)}>
                      <img src={p.imageUrl} className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${isOutOfStock ? 'grayscale opacity-70' : ''}`}/> 
                      {/* ไอคอนแว่นขยายเมื่อเอาเมาส์ชี้ */}
                      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ZoomIn className="text-white drop-shadow-md" size={32}/>
                      </div>
                      {/* ป้ายสินค้าหมด */}
                      {isOutOfStock && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <span className="bg-black/70 text-white px-3 py-1 rounded-lg text-sm font-bold">สินค้าหมด</span>
                          </div>
                      )}
                    </div>

                    <div className="p-3 md:p-5 flex flex-col flex-grow">
                      {/* Product Code */}
                      <div className="text-[10px] md:text-xs text-gray-400 mb-1 font-mono uppercase tracking-wide">
                          Code: {p.code || '-'}
                      </div>
                      
                      <h3 className="font-bold text-sm md:text-xl text-gray-900 mb-1 md:mb-2 line-clamp-1">{p.name}</h3>
                      <p className="text-gray-500 text-xs md:text-sm mb-2 flex-grow line-clamp-2">{p.description}</p>
                      
                      {/* Stock Display */}
                      <div className="flex justify-between items-center mb-3">
                         <span className={`text-xs font-bold ${isOutOfStock ? 'text-red-500' : 'text-green-600'}`}>
                             {isOutOfStock ? 'หมดแล้ว' : `เหลือ ${p.stock} ชิ้น`}
                         </span>
                      </div>

                      <button 
                        disabled={isOutOfStock}
                        onClick={() => { setSelectedProduct(p); setView('form'); }} 
                        className={`w-full py-2 md:py-3 rounded-lg md:rounded-xl font-bold text-xs md:text-base shadow-lg transition-all active:scale-95 ${isOutOfStock ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#003781] text-white hover:bg-[#002860] hover:shadow-blue-900/10'}`}
                      >
                        {isOutOfStock ? 'สินค้าหมด' : 'แลกรับสิทธิ์'}
                      </button> 
                    </div>
                  </div>
                );
              })}
            </div>
           </div>
        )}

        {/* VIEW: FORM */}
        {view === 'form' && selectedProduct && (
          <div className="w-full max-w-4xl mx-auto animate-slide-up pb-10">
            <button onClick={() => setView('home')} className="mb-4 text-gray-500 hover:text-[#003781] flex items-center gap-2 font-medium transition-colors text-sm md:text-base">
              <ArrowLeft size={20} /> ย้อนกลับไปเลือกสินค้า 
            </button>
            
            <div className="bg-white rounded-xl md:rounded-2xl shadow-lg border border-gray-200 overflow-hidden w-full">
              {/* Product Header */}
              <div className="bg-blue-50/50 p-4 md:p-8 border-b flex flex-col sm:flex-row gap-4 md:gap-6 items-center sm:items-start text-center sm:text-left">
                 <div className="relative group cursor-pointer" onClick={() => setViewingImage(selectedProduct.imageUrl)}>
                    <img src={selectedProduct.imageUrl} className="w-32 h-32 md:w-40 md:h-40 rounded-xl object-cover shadow-md bg-white border-4 border-white flex-shrink-0" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-all rounded-xl">
                        <ZoomIn className="text-white opacity-0 group-hover:opacity-100 drop-shadow-md"/>
                    </div>
                 </div>
                 <div className="w-full">
                   <div className="text-[#003781] text-xs md:text-sm font-bold uppercase mb-1 tracking-wide">
                       CODE: {selectedProduct.code || '-'}
                   </div>
                   <h2 className="text-xl md:text-3xl font-bold text-gray-900 leading-tight mb-2">{selectedProduct.name}</h2> 
                   <p className="text-gray-600 text-sm md:text-base mb-2">{selectedProduct.description}</p>
                   <div className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold">
                       สถานะ: มีสินค้า ({selectedProduct.stock})
                   </div>
                 </div>
              </div>

              <div className="p-4 md:p-10 w-full">
                <form onSubmit={handleSubmitOrder} className="space-y-6 w-full">
                  
                  {/* Delivery Method Toggle */}
                  <div className="w-full">
                    <label className="block text-sm font-bold text-gray-700 mb-3">เลือกวิธีการรับของขวัญ</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-6">
                      <div 
                        onClick={() => setDeliveryMethod('delivery')}
                        className={`w-full cursor-pointer rounded-xl p-4 md:p-6 border-2 flex flex-col items-center justify-center gap-2 transition-all h-full min-h-[120px] ${deliveryMethod === 'delivery' ? 'border-[#003781] bg-blue-50 text-[#003781]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                      >
                        <Truck size={32} className="mb-1" />
                        <span className="font-bold text-sm md:text-lg text-center">จัดส่งถึงบ้าน</span>
                      </div>
                      <div 
                        onClick={() => setDeliveryMethod('pickup')}
                        className={`w-full cursor-pointer rounded-xl p-4 md:p-6 border-2 flex flex-col items-center justify-center gap-2 transition-all h-full min-h-[120px] ${deliveryMethod === 'pickup' ? 'border-[#003781] bg-blue-50 text-[#003781]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                      >
                        <Handshake size={32} className="mb-1" />
                        <span className="font-bold text-sm md:text-lg text-center">สะดวกนัดรับ</span>
                      </div>
                    </div>
                  </div>

                  {/* Input Fields */}
                  <div className="w-full space-y-4 md:space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full">
                          <div>
                              <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                              <User size={18} className="text-[#003781]"/> ชื่อ-นามสกุล
                              </label>
                              <input required className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 bg-white focus:ring-2 focus:ring-[#003781] outline-none transition text-base" 
                              placeholder="ระบุชื่อจริง นามสกุล" 
                              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                          </div>

                          <div>
                              <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                              <Phone size={18} className="text-[#003781]"/> เบอร์โทรศัพท์
                              </label>
                              <input required type="tel" className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 bg-white focus:ring-2 focus:ring-[#003781] outline-none transition text-base" 
                              placeholder="เช่น 0891234567" 
                              value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /> 
                          </div>
                      </div>

                      {/* Address Field */}
                      <div>
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                          <MapPin size={18} className="text-[#003781]"/> 
                          {deliveryMethod === 'delivery' ? 'ที่อยู่จัดส่ง' : 'ระบุสถานที่นัดรับ'} 
                        </label>
                        <textarea 
                          required 
                          rows={3} 
                          className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 bg-white focus:ring-2 focus:ring-[#003781] outline-none transition text-base resize-none leading-relaxed" 
                          placeholder={deliveryMethod === 'delivery' 
                            ? "บ้านเลขที่, หมู่บ้าน/คอนโด, ซอย, ถนน\nแขวง/ตำบล, เขต/อำเภอ\nจังหวัด, รหัสไปรษณีย์" 
                            : "ระบุจุดนัดพบให้ชัดเจน เช่น \n- BTS สยาม ทางออก 1\n- เซ็นทรัลลาดพร้าว หน้า Uniqlo\n- บ้านเลขที่... (บ้านตัวแทน/ลูกค้า)"}
                          value={formData.address} 
                          onChange={e => setFormData({...formData, address: e.target.value})} 
                        />
                        <p className="text-xs text-gray-400 mt-2 text-right">
                          {deliveryMethod === 'delivery' ? '*กรุณาระบุให้ครบถ้วนเพื่อความรวดเร็วในการจัดส่ง' : '*เจ้าหน้าที่จะติดต่อนัดหมายเวลาอีกครั้ง'} 
                        </p>
                      </div>

                      {/* Dummy Box Logic for Stability */}
                      {deliveryMethod === 'pickup' ? (
                        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 w-full animate-fade-in">
                          <label className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-2">
                            <Calendar size={18} className="text-[#003781]"/> เลือกวันและเวลานัดรับ
                          </label>
                          <input 
                            required 
                            type="datetime-local" 
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 bg-white focus:ring-2 focus:ring-[#003781] outline-none transition text-base"
                            value={formData.pickupDate}
                            onChange={e => setFormData({...formData, pickupDate: e.target.value})} 
                          />
                          <div className="flex gap-2 mt-3 text-red-600 text-xs md:text-sm items-start bg-white p-3 rounded-lg border border-red-100">
                           <div className="font-bold whitespace-nowrap">*หมายเหตุ:</div>
                            <div>ทางตัวแทนจะ confirm วันเวลาที่คุณเลือกมาอีกครั้งใน Line OA ต่อไป</div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-transparent p-4 rounded-xl border border-transparent w-full opacity-0 pointer-events-none select-none" aria-hidden="true">
                          <label className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-2">
                            <Calendar size={18} /> เลือกวันและเวลานัดรับ
                          </label>
                          <div className="w-full px-4 py-3 rounded-xl border border-transparent text-base">dummy input</div>
                          <div className="flex gap-2 mt-3 text-xs md:text-sm items-start p-3 rounded-lg border border-transparent">
                           <div className="font-bold whitespace-nowrap">*หมายเหตุ:</div>
                            <div>ทางตัวแทนจะ confirm วันเวลาที่คุณเลือกมาอีกครั้งใน Line OA ต่อไป</div>
                          </div>
                        </div>
                      )}
                      
                      {/* Remark Field */}
                      <div className="w-full">
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-600 mb-2">
                          <FileText size={18} /> หมายเหตุ (ถ้ามี)
                        </label>
                        <input 
                          className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 bg-white focus:ring-2 focus:ring-[#003781] outline-none transition text-base"
                          placeholder="ฝากข้อความถึงผู้ส่ง (ไม่ระบุก็ได้)"
                          value={formData.remark}
                          onChange={e => setFormData({...formData, remark: e.target.value})}
                        />
                      </div>

                  </div>

                  <button disabled={loading} className="w-full bg-[#003781] hover:bg-[#002860] text-white py-4 rounded-xl font-bold text-lg shadow-lg transition-all mt-8 active:scale-95 flex items-center justify-center gap-3">
                    {loading ? 'กำลังบันทึก...' : <><CheckCircle size={24}/> ยืนยันการรับสิทธิ์</>}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: SUCCESS */}
        {view === 'success' && (
          <div className="w-full max-w-2xl mx-auto animate-slide-up pb-10">
             <div className="bg-white rounded-xl md:rounded-2xl shadow-lg border border-gray-200 overflow-hidden w-full p-6 md:p-10 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 md:w-24 md:h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle className="text-green-600 w-10 h-10 md:w-12 md:h-12" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">บันทึกข้อมูลสำเร็จ!</h2>
                
                <div className="bg-blue-50 p-4 md:p-6 rounded-xl border border-blue-100 mb-8 w-full text-center">
                  <p className="text-[#003781] leading-relaxed text-base md:text-lg font-bold">
                    {finalDeliveryMethod === 'delivery' 
                      ? "ขอบคุณที่ร่วมกิจกรรมกับเรา ทางเราจะจัดส่งของขวัญให้ท่านโดยเร็วที่สุด"
                      : "ขอบคุณที่ร่วมกิจกรรมกับเรา ทางเราจะติดต่อ Confirm วันเวลาสะดวกในการนัดรับของขวัญกับท่านโดยเร็วที่สุด"
                    }
                  </p>
                </div>

                <div className="w-full bg-gray-50 rounded-xl border border-dashed border-gray-300 p-6 mb-8 text-left relative">
                   <div className="flex items-center gap-2 mb-4 border-b border-gray-200 pb-2">
                      <Receipt size={20} className="text-gray-500"/>
                      <span className="font-bold text-gray-700 text-lg">สรุปรายการ (Summary)</span>
                   </div>
                   <div className="space-y-3 text-sm md:text-base text-gray-700">
                      <div className="flex justify-between">
                        <span className="text-gray-500">รหัสสินค้า:</span>
                        <span className="font-bold text-right font-mono">{selectedProduct.code}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">สินค้า:</span>
                        <span className="font-bold text-right">{selectedProduct.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">วิธีรับ:</span>
                        <span className="font-bold text-right text-[#003781]">{finalDeliveryMethod === 'delivery' ? 'จัดส่งถึงบ้าน' : 'นัดรับ'}</span> 
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">ชื่อผู้รับ:</span>
                        <span className="font-bold text-right">{formData.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">เบอร์โทร:</span>
                        <span className="font-bold text-right">{formData.phone}</span>
                      </div>
                      
                      <div className="flex justify-between items-start">
                        <span className="text-gray-500 whitespace-nowrap">ที่อยู่/นัดรับ:</span>
                        <span className="font-bold text-right ml-4 text-xs md:text-base">{formData.address}</span>
                      </div>

                      {finalDeliveryMethod === 'pickup' && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">เวลานัดหมาย:</span>
                          <span className="font-bold text-right text-orange-600">{new Date(formData.pickupDate).toLocaleString('th-TH')}</span> 
                        </div>
                      )}
                      {formData.remark && (
                         <div className="flex justify-between">
                           <span className="text-gray-500">หมายเหตุ:</span>
                           <span className="font-bold text-right text-gray-600">{formData.remark}</span> 
                         </div>
                      )}

                      <div className="pt-2 border-t border-gray-200 mt-2 text-xs text-gray-400 text-center">
                        รหัสอ้างอิง: {new Date().getTime().toString().slice(-6)}
                      </div>
                   </div>
                </div>

                <div className="w-full max-w-sm space-y-4">
                  <p className="text-gray-500 text-sm">หากมีข้อสงสัยติดต่อ:</p>
                  <a 
                    href="https://line.me/R/ti/p/@386cqgdi" 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-[#00B900] hover:bg-[#009900] text-white py-3.5 rounded-xl font-bold transition-all shadow-md active:scale-95 text-base"
                  >
                    <MessageCircle size={22} />
                    Line OA นัท อลิอันซ์ 
                  </a>
                  <button onClick={() => window.location.reload()} className="w-full bg-gray-100 text-gray-600 hover:text-[#003781] px-10 py-3.5 rounded-xl font-bold hover:bg-gray-200 transition-all text-base">
                    กลับสู่หน้าหลัก
                  </button>
                </div>
             </div>
          </div>
        )}

        {/* VIEW: LOGIN */}
        {view === 'login' && (
          <div className="max-w-sm mx-auto mt-10 p-8 bg-white rounded-2xl shadow-xl border border-gray-100 text-center">
             <div className="mb-6 flex justify-center text-[#003781]"><Lock size={48}/></div>
             <h2 className="text-2xl font-bold text-gray-900 mb-6">ผู้ดูแลระบบ</h2>
             <form onSubmit={handleLogin} className="space-y-4">
               <input 
                 type="password" 
                 autoFocus
                 className="w-full px-4 py-3 text-center text-xl tracking-widest border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#003781] outline-none text-gray-900"
                 placeholder="รหัสผ่าน"
                 value={adminPassInput}
                 onChange={e => setAdminPassInput(e.target.value)}
               />
               <button className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-black transition">เข้าสู่ระบบ</button> 
               <div onClick={() => setView('home')} className="text-sm text-gray-400 cursor-pointer hover:underline mt-4">กลับหน้าหลัก</div>
             </form>
          </div>
        )}

        {/* VIEW: ADMIN DASHBOARD */}
        {view === 'admin' && (
          <div className="animate-fade-in w-full">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
               <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-gray-900">
                 <Database className="text-[#003781]"/> ระบบหลังบ้าน
               </h2>
               <div className="flex gap-2 w-full md:w-auto">
                 <button onClick={() => setView('home')} className="flex-1 md:flex-none justify-center px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200 whitespace-nowrap">ดูหน้าเว็บ</button>
                 <button onClick={() => setView('home')} className="flex-1 md:flex-none justify-center px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg flex items-center gap-2 whitespace-nowrap"><LogOut size={16}/> ออก</button>
               </div>
             </div>

             <div className="flex gap-2 mb-6 border-b overflow-x-auto pb-1 no-scrollbar w-full">
               <button onClick={() => setAdminTab('orders')} className={`px-4 py-2 rounded-t-lg font-bold whitespace-nowrap text-sm md:text-base ${adminTab === 'orders' ? 'bg-[#003781] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>📦 ออเดอร์ ({orders.length})</button> 
               <button onClick={() => setAdminTab('products')} className={`px-4 py-2 rounded-t-lg font-bold whitespace-nowrap text-sm md:text-base ${adminTab === 'products' ? 'bg-[#003781] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>🛍️ สินค้า</button>
               <button onClick={() => setAdminTab('settings')} className={`px-4 py-2 rounded-t-lg font-bold whitespace-nowrap text-sm md:text-base ${adminTab === 'settings' ? 'bg-[#003781] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>🖼️ ตั้งค่าเว็บ</button>
             </div>
             
             <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 min-h-[400px] w-full">
               
               {/* TAB: ORDERS */}
               {adminTab === 'orders' && (
                 <div className="w-full">
                    {/* Modal แก้ไขออเดอร์ */}
                    {editingOrder && (
                      <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-2xl animate-slide-up">
                          <div className="flex justify-between mb-4">
                             <h3 className="text-xl font-bold">แก้ไขออเดอร์</h3>
                             <button onClick={() => setEditingOrder(null)}><X className="text-gray-400 hover:text-red-500"/></button>
                          </div>
                          <form onSubmit={handleSaveOrder} className="space-y-3">
                            <div><label className="text-xs text-gray-500">ชื่อลูกค้า</label>
                            <input required className="w-full p-2 border rounded text-gray-900" value={editingOrder.name} onChange={e => setEditingOrder({...editingOrder, name: e.target.value})} /></div>
                            <div><label className="text-xs text-gray-500">เบอร์โทร</label>
                            <input required className="w-full p-2 border rounded text-gray-900" value={editingOrder.phone} onChange={e => setEditingOrder({...editingOrder, phone: e.target.value})} /></div>
                            <div><label className="text-xs text-gray-500">ที่อยู่ / จุดนัดรับ</label>
                            <textarea required rows={3} className="w-full p-2 border rounded text-gray-900" value={editingOrder.address} onChange={e => setEditingOrder({...editingOrder, address: e.target.value})} /></div>
                            
                            <div className="pt-2 flex gap-3">
                              <button type="submit" className="flex-1 bg-[#003781] text-white py-2 rounded-lg font-bold">บันทึก</button>
                            </div>
                          </form>
                        </div>
                      </div>
                    )}

                   {/* ตารางแบบเลื่อนได้ */}
                   <div className="overflow-x-auto w-full">
                     <table className="w-full text-left text-sm min-w-[800px]">
                       <thead className="bg-gray-50 text-gray-700 font-bold border-b">
                         <tr>
                           <th className="p-3 w-32">วันที่</th>
                           <th className="p-3 w-28">ประเภท</th>
                           <th className="p-3 w-40">ลูกค้า</th>
                           <th className="p-3 w-32">เบอร์โทร</th>
                           <th className="p-3 w-40">สินค้า (Code)</th>
                           <th className="p-3">ที่อยู่ / วันนัดรับ</th>
                           <th className="p-3 w-24 text-center">จัดการ</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y">
                         {orders.map((order) => (
                           <tr key={order.id} className="hover:bg-gray-50 text-gray-800">
                             <td className="p-3 text-gray-500 whitespace-nowrap">{order.timestamp?.toDate().toLocaleDateString('th-TH')}</td>
                             <td className="p-3">
                               <span className={`px-2 py-1 rounded text-xs font-bold ${order.deliveryMethod === 'นัดรับ' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                 {order.deliveryMethod || 'จัดส่ง'}
                               </span>
                             </td>
                             <td className="p-3 font-medium text-[#003781]">{order.name}</td>
                             <td className="p-3">{order.phone}</td>
                             <td className="p-3">
                                 <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md text-xs block truncate w-fit max-w-[150px]">{order.product}</span>
                                 <span className="text-[10px] text-gray-400 font-mono mt-1">Code: {order.productCode}</span>
                             </td>
                             <td className="p-3 text-gray-600 min-w-[200px] text-xs">
                                {order.address}
                                {order.remark && <div className="text-gray-400 italic">Note: {order.remark}</div>}
                                {order.pickupDate && (
                                  <div className="mt-1 text-orange-600 font-bold">
                                    นัด: {new Date(order.pickupDate).toLocaleString('th-TH')}
                                  </div>
                                )}
                             </td>
                             <td className="p-3 text-center flex gap-1 justify-center">
                               <button onClick={() => setEditingOrder(order)} className="p-1.5 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"><Edit size={14}/></button>
                               <button onClick={() => handleDeleteOrder(order.id)} className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200"><Trash2 size={14}/></button>
                             </td>
                           </tr>
                       ))}
                       </tbody>
                     </table>
                     {orders.length === 0 && <div className="p-10 text-center text-gray-400 flex flex-col items-center gap-2"><Package size={40}/> ยังไม่มีรายการสั่งซื้อ</div>} 
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

                    {/* Modal สินค้า */}
                    {editingProduct && (
                      <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
                           <div className="flex justify-between mb-4">
                             <h3 className="text-xl font-bold">{editingProduct.id ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h3>
                             <button onClick={() => setEditingProduct(null)}><X className="text-gray-400 hover:text-red-500"/></button>
                           </div>
                          <form onSubmit={handleSaveProduct} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500 font-bold">รหัสสินค้า (Code)</label>
                                    <input required className="w-full p-2 border rounded text-gray-900 bg-gray-50" placeholder="เช่น ABC-001" value={editingProduct.code || ''} onChange={e => setEditingProduct({...editingProduct, code: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 font-bold">จำนวนสต็อก (Stock)</label>
                                    <input required type="number" className="w-full p-2 border rounded text-gray-900 bg-gray-50" placeholder="0" value={editingProduct.stock || 0} onChange={e => setEditingProduct({...editingProduct, stock: e.target.value})} />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-gray-500 font-bold">ชื่อสินค้า</label>
                                <input required className="w-full p-2 border rounded text-gray-900" value={editingProduct.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} />
                            </div>
                            
                            <div>
                                <label className="text-xs text-gray-500 font-bold">รายละเอียด</label>
                                <input required className="w-full p-2 border rounded text-gray-900" value={editingProduct.description || ''} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} />
                            </div>

                            <div className="border p-3 rounded-lg bg-gray-50">
                                <label className="text-xs text-gray-500 font-bold mb-2 block">รูปสินค้า (อัปโหลด หรือ ใส่ลิงก์)</label>
                                
                                {/* 1. เลือกไฟล์ (แปลงเป็น Base64) */}
                                <input type="file" accept="image/*" onChange={handleImageUpload} className="w-full mb-2 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                                
                                <div className="text-center text-gray-400 text-xs my-1">- หรือ -</div>
                                
                                {/* 2. ใส่ลิงก์ (เผื่ออยากใช้แบบเดิม) */}
                                <input className="w-full p-2 border rounded text-gray-900 text-sm" placeholder="วางลิงก์รูปภาพ (URL) ที่นี่..." value={editingProduct.imageUrl || ''} onChange={e => setEditingProduct({...editingProduct, imageUrl: e.target.value})} />
                                
                                {editingProduct.imageUrl && (
                                    <div className="mt-2 text-center">
                                        <img src={editingProduct.imageUrl} className="h-20 mx-auto rounded border bg-white object-contain"/>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="isNew" className="w-4 h-4" checked={editingProduct.isNew || false} onChange={e => setEditingProduct({...editingProduct, isNew: e.target.checked})}/>
                                <label htmlFor="isNew" className="text-sm text-gray-700">แสดงป้าย <span className="text-red-500 font-bold">New Arrival</span></label>
                            </div>
                            
                            <div className="pt-2 flex gap-3">
                              <button type="submit" className="flex-1 bg-[#003781] text-white py-3 rounded-lg font-bold shadow-lg hover:bg-[#002860]">บันทึกข้อมูล</button>
                            </div>
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
                                <div className="text-xs font-mono bg-gray-100 px-1 rounded text-gray-500">{p.code}</div>
                            </div>
                            <div className="text-xs text-gray-500 mb-1 truncate">{p.description}</div>
                            <div className="text-xs font-bold mb-2 text-blue-600">Stock: {p.stock}</div>
                            
                            <div className="flex gap-2">
                               <button onClick={() => handleToggleProduct(p)} className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${p.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                 {p.active ? <><Eye size={12}/> แสดง</> : <><EyeOff size={12}/> ซ่อน</>}
                               </button>
                               <button onClick={() => setEditingProduct(p)} className="px-2 py-1 bg-blue-50 rounded text-xs text-blue-600 flex items-center gap-1"><Edit size={12}/> แก้ไข</button>
                               <button onClick={() => handleDeleteProduct(p.id)} className="px-2 py-1 bg-red-50 rounded text-xs text-red-600 flex items-center gap-1"><Trash2 size={12}/> ลบ</button>
                            </div>
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
                     <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">หัวข้อหลัก (Banner Title)</label>
                       <textarea rows={2} className="w-full p-3 border rounded-xl text-gray-900" value={bannerSettings.title} onChange={e => setBannerSettings({...bannerSettings, title: e.target.value})} />
                     </div>
                     
                     <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">ข้อความรอง (Subtitle / Badge)</label>
                       <input className="w-full p-3 border rounded-xl text-gray-900" value={bannerSettings.subtitle} onChange={e => setBannerSettings({...bannerSettings, subtitle: e.target.value})} />
                     </div>

                     <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">ลิงก์รูปภาพ (Banner Image URL)</label>
                       <input className="w-full p-3 border rounded-xl text-gray-900" value={bannerSettings.bannerUrl} onChange={e => setBannerSettings({...bannerSettings, bannerUrl: e.target.value})} />
                       <p className="text-xs text-gray-400 mt-1">แนะนำ: ใช้รูปแนวนอน ขนาด 1200px ขึ้นไป</p>
                     </div>

                     <button onClick={handleSaveBanner} className="bg-[#003781] hover:bg-[#002860] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all w-full justify-center md:w-auto">
                       <Save size={18}/> บันทึกการตั้งค่า
                     </button>
                   </div>

                   <div className="mt-8 border-t pt-6">
                     <p className="text-sm font-bold text-gray-700 mb-3">ตัวอย่างรูปปัจจุบัน:</p>
                     <div className="relative rounded-xl overflow-hidden shadow-md h-40">
                       <img src={bannerSettings.bannerUrl} className="w-full h-full object-cover" />
                       <div className="absolute bottom-4 left-4 text-white">
                          <span className="text-xs bg-white/20 px-2 py-0.5 rounded backdrop-blur border border-white/30">{bannerSettings.subtitle}</span>
                          <div className="font-bold text-lg leading-tight mt-1">{bannerSettings.title}</div>
                       </div>
                      </div>
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