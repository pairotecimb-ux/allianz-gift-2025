import { useState, useEffect } from 'react';
import { ShoppingBag, CheckCircle, ArrowLeft, Lock, Database, Edit, Trash2, Plus, Eye, EyeOff, Save, LogOut, X, Package, MapPin, Phone, User, Truck, Handshake, MessageCircle, Calendar, Receipt } from 'lucide-react';
import { db } from './firebase'; 
import { collection, addDoc, getDocs, orderBy, query, Timestamp, doc, updateDoc, deleteDoc, setDoc, getDoc } from 'firebase/firestore';

// --- รหัสผ่านเข้าหลังบ้าน ---
const ADMIN_PASSWORD = "8787"; 

// --- ข้อมูลสินค้าเริ่มต้น ---
const INITIAL_PRODUCTS = [
  { id: '1', name: "กระเป๋าเดินทาง 20 นิ้ว", description: "สี Midnight Blue (Limited)", imageUrl: "https://images.unsplash.com/photo-1565026057447-bc072a804e8f?w=1000", active: true },
  { id: '2', name: "เสื้อฮาวายลายช้าง (L)", description: "ผ้าไหมอิตาลี ใส่สบาย", imageUrl: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=1000", active: true },
  { id: '3', name: "ชุด Gift Set รักษ์โลก", description: "แก้วน้ำ + ถุงผ้า", imageUrl: "https://images.unsplash.com/photo-1542435503-956c469947f6?w=1000", active: true },
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
  const [loading, setLoading] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery');
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', address: '', pickupDate: '' }); 
  const [finalDeliveryMethod, setFinalDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery'); 
  
  // Admin States
  const [orders, setOrders] = useState<any[]>([]);
  const [adminPassInput, setAdminPassInput] = useState(''); 
  const [adminTab, setAdminTab] = useState('orders'); 
  const [editingProduct, setEditingProduct] = useState<any>(null); 
  const [editingOrder, setEditingOrder] = useState<any>(null);

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

  // --- 2. ฟังก์ชันลูกค้า ---
  const handleSubmitOrder = async (e: any) => {
    e.preventDefault();
    setLoading(true); 
    try {
      await addDoc(collection(db, "orders"), {
        ...formData,
        deliveryMethod: deliveryMethod === 'delivery' ? 'จัดส่งถึงบ้าน' : 'นัดรับ', 
        product: selectedProduct.name,
        productId: selectedProduct.id,
        timestamp: Timestamp.now(),
        status: 'pending'
      });
      setFinalDeliveryMethod(deliveryMethod); 
      setLoading(false);
      setView('success');
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
      const isNew = !editingProduct.id;
      if (isNew) { 
        await addDoc(collection(db, "products"), { ...editingProduct, active: true });
      } else {
        const { id, ...data } = editingProduct;
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
          <span className="text-xs text-gray-400">Campaign by นัท อลิอันซ์ v4.0 (Final)</span> 
        </p>
      </div>
    </footer>
  ); 

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 flex flex-col w-full">
      
      {/* Navbar */}
      <div className="bg-white shadow-sm sticky top-0 z-50 w-full">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
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
        <div className="container mx-auto px-4 md:px-6">
        
        {/* VIEW: HOME */}
        {view === 'home' && (
           <div className="animate-fade-in w-full">
            {/* Banner */}
            <div className="relative w-full aspect-[21/9] min-h-[200px] max-h-[400px] rounded-2xl overflow-hidden shadow-xl mb-8 md:mb-12 group">
              <img src={bannerSettings.bannerUrl} className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" alt="Banner"/>
              <div className="absolute inset-0 bg-gradient-to-r from-[#003781]/95 via-[#003781]/70 to-transparent flex items-center p-6 md:p-12">
                 <div className="text-white w-full max-w-xl">
                    <span className="bg-white/20 backdrop-blur text-xs md:text-sm px-3 py-1 rounded-full mb-3 inline-block border border-white/30 shadow-sm">
                      {bannerSettings.subtitle} 
                    </span>
                    <h1 className="text-2xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight drop-shadow-lg whitespace-pre-line">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8 w-full">
              {products.filter(p => p.active).map((p) => (
                <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl transition-all group flex flex-col w-full">
                  <div className="aspect-[4/3] w-full overflow-hidden relative bg-gray-100">
                    <img src={p.imageUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"/> 
                  </div>
                  <div className="p-5 flex flex-col flex-grow">
                    <h3 className="font-bold text-lg md:text-xl text-gray-900 mb-2 line-clamp-1">{p.name}</h3>
                    <p className="text-gray-500 text-sm mb-4 flex-grow line-clamp-2">{p.description}</p>
                    <button onClick={() => { setSelectedProduct(p); setView('form'); }} className="w-full bg-[#003781] text-white py-3 rounded-xl font-bold text-base shadow-blue-900/10 hover:bg-[#002860] hover:shadow-lg transition-all active:scale-95">
                      แลกรับสิทธิ์
                    </button> 
                  </div>
                </div>
              ))}
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
                 <img src={selectedProduct.imageUrl} className="w-32 h-32 md:w-40 md:h-40 rounded-xl object-cover shadow-md bg-white border-4 border-white flex-shrink-0" />
                 <div className="w-full">
                   <div className="text-[#003781] text-xs md:text-sm font-bold uppercase mb-1 tracking-wide">ของขวัญที่คุณเลือก</div>
                   <h2 className="text-xl md:text-3xl font-bold text-gray-900 leading-tight mb-2">{selectedProduct.name}</h2> 
                   <p className="text-gray-600 text-sm md:text-base">{selectedProduct.description}</p>
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

                      <div>
                          <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                          <TiltedMailIcon size={18} /> อีเมล (สำหรับรับข้อมูล)
                          </label>
                          <input required type="email" className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 bg-white focus:ring-2 focus:ring-[#003781] outline-none transition text-base" 
                          placeholder="example@mail.com" 
                          value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /> 
                      </div>

                      {/* Pickup Date / Dummy Box Logic */}
                      {deliveryMethod === 'pickup' ? (
                        // 1. กล่องจริง: แสดงเมื่อเลือก "นัดรับ"
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
                        // 2. กล่องหลอก (Dummy): แสดงเมื่อเลือก "จัดส่ง"
                        // ใช้ opacity-0 เพื่อให้มองไม่เห็น แต่ยังกินพื้นที่เท่าเดิม
                        <div className="p-4 rounded-xl border border-transparent w-full select-none pointer-events-none opacity-0" aria-hidden="true">
                          <label className="flex items-center gap-2 text-sm font-bold mb-2">
                            <Calendar size={18} /> เลือกวันและเวลานัดรับ
                          </label>
                          <div className="w-full px-4 py-3 rounded-xl border border-transparent text-base">
                             &nbsp; 
                          </div>
                          <div className="flex gap-2 mt-3 text-xs md:text-sm items-start p-3 rounded-lg border border-transparent">
                           <div className="font-bold whitespace-nowrap">*หมายเหตุ:</div>
                            <div>ทางตัวแทนจะ confirm วันเวลาที่คุณเลือกมาอีกครั้งใน Line OA ต่อไป</div>
                          </div>
                        </div>
                      )}

                      {/* Address */}
                      <div>
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                          <MapPin size={18} className="text-[#003781]"/> 
                          {deliveryMethod === 'delivery' ? 'ที่อยู่จัดส่ง' : 'ระบุสถานที่นัดรับ'} 
                        </label>
                        <textarea 
                          required 
                          rows={4} 
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
                      {finalDeliveryMethod === 'pickup' && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">เวลานัดหมาย:</span>
                          <span className="font-bold text-right text-orange-600">{new Date(formData.pickupDate).toLocaleString('th-TH')}</span> 
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
                           <th className="p-3 w-40">สินค้า</th>
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
                             <td className="p-3"><span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md text-xs">{order.product}</span></td>
                             <td className="p-3 text-gray-600 min-w-[200px] text-xs">
                                {order.address}
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
                          <form onSubmit={handleSaveProduct} className="space-y-3">
                            <div><label className="text-xs text-gray-500">ชื่อสินค้า</label>
                            <input required className="w-full p-2 border rounded text-gray-900" value={editingProduct.name || ''} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} /></div>
                            <div><label className="text-xs text-gray-500">รายละเอียด</label>
                            <input required className="w-full p-2 border rounded text-gray-900" value={editingProduct.description || ''} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} /></div>
                            <div><label className="text-xs text-gray-500">ลิงก์รูปภาพ (URL)</label>
                            <input required className="w-full p-2 border rounded text-gray-900" value={editingProduct.imageUrl || ''} onChange={e => setEditingProduct({...editingProduct, imageUrl: e.target.value})} /></div>
                            
                            <div className="pt-2 flex gap-3">
                              <button type="submit" className="flex-1 bg-[#003781] text-white py-2 rounded-lg font-bold">บันทึก</button>
                            </div>
                          </form>
                        </div>
                    </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {products.map(p => (
                        <div key={p.id} className={`border rounded-xl p-4 flex gap-4 items-start ${!p.active ? 'opacity-60 bg-gray-100' : 'bg-white'}`}>
                          <img src={p.imageUrl} className="w-16 h-16 rounded object-cover bg-gray-200 flex-shrink-0"/>
                          <div className="flex-grow min-w-0">
                            <div className="font-bold text-gray-900 truncate">{p.name}</div>
                            <div className="text-xs text-gray-500 mb-2 truncate">{p.description}</div>
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

// Icon for Mail
const TiltedMailIcon = ({size}: {size: number}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mail"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
);