import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  CheckCircle,
  MapPin,
  Phone,
  ArrowLeft,
  Lock,
  Database,
  Edit,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  Save,
  Image as ImageIcon,
  X,
  LogOut,
} from 'lucide-react';
import { db } from './firebase';
import {
  collection,
  addDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDoc,
} from 'firebase/firestore';

// --- รหัสผ่านเข้าหลังบ้าน (แก้ตรงนี้ได้เลย) ---
const ADMIN_PASSWORD = '8787';

// --- ข้อมูลเริ่มต้น (ใช้กรณีเปิดเว็บครั้งแรกแล้วยังไม่มีข้อมูลใน Database) ---
const INITIAL_PRODUCTS = [
  {
    id: '1',
    name: 'กระเป๋าเดินทาง 20 นิ้ว',
    description: 'สี Midnight Blue (Limited)',
    imageUrl:
      'https://images.unsplash.com/photo-1565026057447-bc072a804e8f?w=1000',
    active: true,
    stock: 10,
  },
  {
    id: '2',
    name: 'เสื้อฮาวายลายช้าง (L)',
    description: 'ผ้าไหมอิตาลี ใส่สบาย',
    imageUrl:
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=1000',
    active: true,
    stock: 50,
  },
  {
    id: '3',
    name: 'ชุด Gift Set รักษ์โลก',
    description: 'แก้วน้ำ + ถุงผ้า',
    imageUrl:
      'https://images.unsplash.com/photo-1542435503-956c469947f6?w=1000',
    active: true,
    stock: 30,
  },
];

export default function App() {
  // --- States ---
  const [view, setView] = useState('home'); // home, form, success, login, admin
  const [products, setProducts] = useState([]);
  const [bannerUrl, setBannerUrl] = useState(
    'https://images.unsplash.com/photo-1549417229-aa67d3263c09?w=2000'
  );
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
  });

  // Admin States
  const [orders, setOrders] = useState([]);
  const [adminPassInput, setAdminPassInput] = useState('');
  const [adminTab, setAdminTab] = useState('orders'); // orders, products, settings
  const [editingProduct, setEditingProduct] = useState(null); // สินค้าที่กำลังแก้ไข

  // --- 1. โหลดข้อมูลเมื่อเข้าเว็บ ---
  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    setLoading(true);
    try {
      // 1. ดึงข้อมูลสินค้า
      const pQuery = query(collection(db, 'products'));
      const pSnapshot = await getDocs(pQuery);
      let pList = pSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // ถ้าไม่มีสินค้าใน DB เลย (เปิดครั้งแรก) ให้สร้างข้อมูลเริ่มต้น
      if (pList.length === 0) {
        for (const p of INITIAL_PRODUCTS) {
          await setDoc(doc(db, 'products', p.id), p);
        }
        pList = INITIAL_PRODUCTS;
      }
      setProducts(pList);

      // 2. ดึงการตั้งค่า (Banner)
      const settingSnap = await getDoc(doc(db, 'settings', 'main'));
      if (settingSnap.exists()) {
        setBannerUrl(settingSnap.data().bannerUrl);
      } else {
        // สร้างค่าเริ่มต้นถ้าไม่มี
        await setDoc(doc(db, 'settings', 'main'), { bannerUrl: bannerUrl });
      }
    } catch (err) {
      console.error('Error fetching:', err);
    }
    setLoading(false);
  };

  // --- 2. ฟังก์ชันลูกค้า ---
  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'orders'), {
        ...formData,
        product: selectedProduct.name,
        productId: selectedProduct.id,
        timestamp: Timestamp.now(),
        status: 'pending',
      });
      setLoading(false);
      setView('success');
    } catch (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
      setLoading(false);
    }
  };

  // --- 3. ฟังก์ชัน Admin ---
  const handleLogin = (e) => {
    e.preventDefault();
    if (adminPassInput === ADMIN_PASSWORD) {
      fetchOrders();
      setView('admin');
      setAdminPassInput('');
    } else {
      alert('รหัสผ่านไม่ถูกต้อง');
    }
  };

  const fetchOrders = async () => {
    const q = query(collection(db, 'orders'), orderBy('timestamp', 'desc'));
    const querySnapshot = await getDocs(q);
    setOrders(querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;

    try {
      const isNew = !editingProduct.id;
      if (isNew) {
        // เพิ่มสินค้าใหม่
        await addDoc(collection(db, 'products'), {
          ...editingProduct,
          active: true,
        });
      } else {
        // อัปเดตสินค้าเดิม
        const { id, ...data } = editingProduct;
        await updateDoc(doc(db, 'products', id), data);
      }
      setEditingProduct(null);
      fetchContent(); // โหลดข้อมูลใหม่
    } catch (err) {
      alert('บันทึกไม่สำเร็จ: ' + err.message);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!confirm('ยืนยันการลบสินค้า?')) return;
    await deleteDoc(doc(db, 'products', id));
    fetchContent();
  };

  const handleToggleProduct = async (product) => {
    await updateDoc(doc(db, 'products', product.id), {
      active: !product.active,
    });
    fetchContent();
  };

  const handleSaveBanner = async () => {
    await setDoc(doc(db, 'settings', 'main'), { bannerUrl: bannerUrl });
    alert('บันทึก Banner แล้ว');
  };

  // --- ส่วนแสดงผล Footer (ใช้ซ้ำได้) ---
  const Footer = () => (
    <footer className="mt-12 py-6 border-t border-gray-200 text-center">
      <p className="text-gray-500 text-sm">
        © 2025 Allianz Ayudhya. สงวนสิทธิ์ 1 ท่านต่อ 1 สิทธิ์ <br />
        <span className="text-xs text-gray-400">Campaign by nut.allianz</span>
      </p>
    </footer>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 flex flex-col">
      {/* Navbar */}
      <div className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div
            onClick={() => setView('home')}
            className="cursor-pointer text-[#003781] font-bold text-xl md:text-2xl flex items-center gap-2"
          >
            Allianz <span className="text-gray-400 font-light">Ayudhya</span>
          </div>
          {/* ปุ่ม Login (เปลี่ยนเป็นไอคอนแม่กุญแจเล็กๆ) */}
          {view !== 'admin' && view !== 'login' && (
            <button
              onClick={() => setView('login')}
              className="text-gray-300 hover:text-[#003781] p-2"
            >
              <Lock size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-grow w-full max-w-7xl mx-auto px-4 py-6">
        {/* --- VIEW: HOME --- */}
        {view === 'home' && (
          <div className="animate-fade-in">
            {/* Banner ที่แก้ไขได้ */}
            <div className="relative h-64 md:h-96 rounded-2xl overflow-hidden shadow-xl mb-10 group">
              <img
                src={bannerUrl}
                className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                alt="Banner"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#003781]/80 to-transparent flex items-center p-8 md:p-16">
                <div className="text-white max-w-xl">
                  <span className="bg-white/20 backdrop-blur text-xs px-3 py-1 rounded-full mb-4 inline-block border border-white/30">
                    2025 Privileges – Exclusive to Nut Allianz Customers
                  </span>
                  <h1 className="text-3xl md:text-5xl font-bold mb-4 drop-shadow-md">
                    ของขวัญพิเศษ
                    <br />
                    แทนคำขอบคุณ
                  </h1>
                  <button
                    onClick={() =>
                      document
                        .getElementById('products-grid')
                        .scrollIntoView({ behavior: 'smooth' })
                    }
                    className="bg-white text-[#003781] px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-blue-50 transition"
                  >
                    เลือกของขวัญ
                  </button>
                </div>
              </div>
            </div>

            <div
              id="products-grid"
              className="mb-6 flex items-center gap-2 text-xl font-bold text-gray-800"
            >
              <ShoppingBag className="text-[#003781]" /> รายการของขวัญ (
              {products.filter((p) => p.active).length})
            </div>

            {/* Grid สินค้า */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {products
                .filter((p) => p.active)
                .map((p) => (
                  <div
                    key={p.id}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl transition-all group h-full flex flex-col"
                  >
                    <div className="h-56 overflow-hidden relative">
                      <img
                        src={p.imageUrl}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    </div>
                    <div className="p-6 flex flex-col flex-grow">
                      <h3 className="font-bold text-lg text-gray-900 mb-2">
                        {p.name}
                      </h3>
                      <p className="text-gray-500 text-sm mb-4 flex-grow">
                        {p.description}
                      </p>
                      <button
                        onClick={() => {
                          setSelectedProduct(p);
                          setView('form');
                        }}
                        className="w-full bg-[#003781] text-white py-3 rounded-xl font-bold shadow-blue-900/10 hover:bg-[#002860] hover:shadow-lg transition-all active:scale-95"
                      >
                        แลกรับสิทธิ์นี้
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* --- VIEW: FORM (แก้ไขตัวหนังสือมองไม่เห็น) --- */}
        {view === 'form' && selectedProduct && (
          <div className="max-w-2xl mx-auto animate-slide-up py-4">
            <button
              onClick={() => setView('home')}
              className="mb-6 text-gray-500 hover:text-[#003781] flex items-center gap-2 font-medium transition-colors"
            >
              <ArrowLeft size={20} /> ย้อนกลับไปเลือกสินค้า
            </button>

            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
              <div className="bg-gray-50 p-6 border-b flex gap-4 items-center">
                <img
                  src={selectedProduct.imageUrl}
                  className="w-20 h-20 rounded-lg object-cover shadow-sm bg-white"
                />
                <div>
                  <div className="text-[#003781] text-xs font-bold uppercase mb-1">
                    Items Selected
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedProduct.name}
                  </h2>
                </div>
              </div>

              <div className="p-6 md:p-8">
                <form onSubmit={handleSubmitOrder} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      ชื่อ-นามสกุล
                    </label>
                    <input
                      required
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 bg-white focus:ring-2 focus:ring-[#003781] focus:border-transparent outline-none transition"
                      placeholder="ระบุชื่อจริง"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      เบอร์โทรศัพท์
                    </label>
                    <input
                      required
                      type="tel"
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 bg-white focus:ring-2 focus:ring-[#003781] outline-none transition"
                      placeholder="08x-xxx-xxxx"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      ที่อยู่จัดส่ง
                    </label>
                    <textarea
                      required
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 bg-white focus:ring-2 focus:ring-[#003781] outline-none transition"
                      placeholder="บ้านเลขที่, หมู่บ้าน, ถนน, เขต/อำเภอ, จังหวัด..."
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                    />
                  </div>

                  <button
                    disabled={loading}
                    className="w-full bg-[#003781] hover:bg-[#002860] text-white py-4 rounded-xl font-bold text-lg shadow-lg transition-all mt-4"
                  >
                    {loading ? 'กำลังบันทึกข้อมูล...' : 'ยืนยันรับสิทธิ์'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW: SUCCESS (แก้ไขปุ่มมองไม่เห็น) --- */}
        {view === 'success' && (
          <div className="max-w-md mx-auto text-center py-16 animate-fade-in">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="text-green-600 w-12 h-12" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              บันทึกข้อมูลสำเร็จ!
            </h2>
            <p className="text-gray-600 mb-8">
              ขอบคุณที่ร่วมรายการ
              <br />
              เจ้าหน้าที่จะทำการจัดส่งของขวัญตามที่อยู่ที่ระบุไว้ ภายใน 7-10
              วันทำการ หากมีข้อสงสัยติดต่อคุณนัท 064-242-8787
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#003781] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#002860] shadow-lg transition-all w-full md:w-auto"
            >
              กลับสู่หน้าหลัก
            </button>
          </div>
        )}

        {/* --- VIEW: LOGIN (หน้าล็อกอินแอดมิน) --- */}
        {view === 'login' && (
          <div className="max-w-sm mx-auto mt-10 p-8 bg-white rounded-2xl shadow-xl border border-gray-100 text-center">
            <div className="mb-6 flex justify-center text-[#003781]">
              <Lock size={48} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              ผู้ดูแลระบบ
            </h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="password"
                autoFocus
                className="w-full px-4 py-3 text-center text-xl tracking-widest border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#003781] outline-none text-gray-900"
                placeholder="รหัสผ่าน"
                value={adminPassInput}
                onChange={(e) => setAdminPassInput(e.target.value)}
              />
              <button className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-black transition">
                เข้าสู่ระบบ
              </button>
              <div
                onClick={() => setView('home')}
                className="text-sm text-gray-400 cursor-pointer hover:underline mt-4"
              >
                กลับหน้าหลัก
              </div>
            </form>
          </div>
        )}

        {/* --- VIEW: ADMIN DASHBOARD (ระบบหลังบ้านเต็มรูปแบบ) --- */}
        {view === 'admin' && (
          <div className="animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
              <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-900">
                <Database className="text-[#003781]" /> ระบบจัดการหลังบ้าน
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setView('home')}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  ไปหน้าเว็บ
                </button>
                <button
                  onClick={() => setView('home')}
                  className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg flex items-center gap-2"
                >
                  <LogOut size={16} /> ออกจากระบบ
                </button>
              </div>
            </div>

            {/* Tab Menu */}
            <div className="flex gap-2 mb-6 border-b overflow-x-auto pb-1">
              <button
                onClick={() => setAdminTab('orders')}
                className={`px-4 py-2 rounded-t-lg font-bold whitespace-nowrap ${
                  adminTab === 'orders'
                    ? 'bg-[#003781] text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                📦 รายการออเดอร์ ({orders.length})
              </button>
              <button
                onClick={() => setAdminTab('products')}
                className={`px-4 py-2 rounded-t-lg font-bold whitespace-nowrap ${
                  adminTab === 'products'
                    ? 'bg-[#003781] text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                🛍️ จัดการสินค้า
              </button>
              <button
                onClick={() => setAdminTab('settings')}
                className={`px-4 py-2 rounded-t-lg font-bold whitespace-nowrap ${
                  adminTab === 'settings'
                    ? 'bg-[#003781] text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                🖼️ ตั้งค่าแบนเนอร์
              </button>
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-h-[400px]">
              {/* TAB: ORDERS */}
              {adminTab === 'orders' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-700 font-bold border-b">
                      <tr>
                        <th className="p-3">วันที่</th>
                        <th className="p-3">ชื่อลูกค้า</th>
                        <th className="p-3">เบอร์โทร</th>
                        <th className="p-3">สินค้า</th>
                        <th className="p-3">ที่อยู่</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {orders.map((order) => (
                        <tr
                          key={order.id}
                          className="hover:bg-gray-50 text-gray-800"
                        >
                          <td className="p-3 text-gray-500 whitespace-nowrap">
                            {order.timestamp
                              ?.toDate()
                              .toLocaleDateString('th-TH')}
                          </td>
                          <td className="p-3 font-medium text-[#003781]">
                            {order.name}
                          </td>
                          <td className="p-3">{order.phone}</td>
                          <td className="p-3">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-xs">
                              {order.product}
                            </span>
                          </td>
                          <td className="p-3 text-gray-600 min-w-[200px]">
                            {order.address}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {orders.length === 0 && (
                    <div className="p-10 text-center text-gray-400">
                      ยังไม่มีรายการสั่งซื้อ
                    </div>
                  )}
                </div>
              )}

              {/* TAB: PRODUCTS (CMS) */}
              {adminTab === 'products' && (
                <div>
                  <div className="flex justify-between mb-4">
                    <h3 className="font-bold text-lg">รายการสินค้าทั้งหมด</h3>
                    <button
                      onClick={() => setEditingProduct({})}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-green-700"
                    >
                      <Plus size={16} /> เพิ่มสินค้าใหม่
                    </button>
                  </div>

                  {/* Modal แก้ไขสินค้า */}
                  {editingProduct && (
                    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                      <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-2xl animate-slide-up">
                        <h3 className="text-xl font-bold mb-4">
                          {editingProduct.id
                            ? 'แก้ไขสินค้า'
                            : 'เพิ่มสินค้าใหม่'}
                        </h3>
                        <form
                          onSubmit={handleSaveProduct}
                          className="space-y-3"
                        >
                          <input
                            required
                            placeholder="ชื่อสินค้า"
                            className="w-full p-2 border rounded text-gray-900"
                            value={editingProduct.name || ''}
                            onChange={(e) =>
                              setEditingProduct({
                                ...editingProduct,
                                name: e.target.value,
                              })
                            }
                          />
                          <input
                            required
                            placeholder="รายละเอียด (สั้นๆ)"
                            className="w-full p-2 border rounded text-gray-900"
                            value={editingProduct.description || ''}
                            onChange={(e) =>
                              setEditingProduct({
                                ...editingProduct,
                                description: e.target.value,
                              })
                            }
                          />
                          <input
                            required
                            placeholder="ลิงก์รูปภาพ (URL)"
                            className="w-full p-2 border rounded text-gray-900"
                            value={editingProduct.imageUrl || ''}
                            onChange={(e) =>
                              setEditingProduct({
                                ...editingProduct,
                                imageUrl: e.target.value,
                              })
                            }
                          />
                          <div className="flex gap-3 mt-4">
                            <button
                              type="submit"
                              className="flex-1 bg-[#003781] text-white py-2 rounded-lg font-bold"
                            >
                              บันทึก
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingProduct(null)}
                              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  {/* List สินค้า */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {products.map((p) => (
                      <div
                        key={p.id}
                        className={`border rounded-xl p-4 flex gap-4 items-center ${
                          !p.active ? 'opacity-50 bg-gray-100' : 'bg-white'
                        }`}
                      >
                        <img
                          src={p.imageUrl}
                          className="w-16 h-16 rounded object-cover bg-gray-200"
                        />
                        <div className="flex-grow">
                          <div className="font-bold text-gray-900">
                            {p.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {p.active ? '🟢 แสดงอยู่' : '🔴 ซ่อนอยู่'}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleToggleProduct(p)}
                            className="p-2 bg-gray-100 rounded hover:bg-gray-200 text-gray-600"
                            title={p.active ? 'ซ่อน' : 'แสดง'}
                          >
                            {p.active ? (
                              <Eye size={16} />
                            ) : (
                              <EyeOff size={16} />
                            )}
                          </button>
                          <button
                            onClick={() => setEditingProduct(p)}
                            className="p-2 bg-blue-50 rounded hover:bg-blue-100 text-blue-600"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p.id)}
                            className="p-2 bg-red-50 rounded hover:bg-red-100 text-red-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB: SETTINGS (BANNER) */}
              {adminTab === 'settings' && (
                <div className="max-w-xl">
                  <h3 className="font-bold text-lg mb-4">ตั้งค่าหน้าเว็บ</h3>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ลิงก์รูปแบนเนอร์ (URL)
                    </label>
                    <div className="flex gap-2">
                      <input
                        className="flex-grow p-3 border rounded-xl text-gray-900"
                        value={bannerUrl}
                        onChange={(e) => setBannerUrl(e.target.value)}
                      />
                      <button
                        onClick={handleSaveBanner}
                        className="bg-[#003781] text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2"
                      >
                        <Save size={18} /> บันทึก
                      </button>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm text-gray-500 mb-2">
                      ตัวอย่างรูปปัจจุบัน:
                    </p>
                    <img
                      src={bannerUrl}
                      className="w-full h-40 object-cover rounded-xl shadow-md"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer (ทุกหน้า) */}
      <Footer />
    </div>
  );
}
