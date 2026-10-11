import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom';
import Layout, { Protected } from './components/Layout';
import { Loading } from './components/Common';
import { AuthProvider, CartProvider, FavoritesProvider, MenuProvider, ThemeProvider, ToastProvider } from './context/providers';
import { IS_PREVIEW } from './api/config';
import { startMotion } from './lib/motion';
import Home from './pages/Home';
import Menu from './pages/Menu';
import DishDetail from './pages/DishDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import { OrderDetail, Orders } from './pages/Orders';
import Book from './pages/Book';
import { Account, Login, Notifications } from './pages/Account';
import { About, Contact, NotFound } from './pages/Static';

const Kitchen = lazy(() => import('./pages/Kitchen'));
const AdminLayout = lazy(() => import('./pages/admin/Admin').then((m) => ({ default: m.AdminLayout })));
const Reports = lazy(() => import('./pages/admin/Admin').then((m) => ({ default: m.Reports })));
const AdminMenu = lazy(() => import('./pages/admin/AdminMenu'));
const AdminOrders = lazy(() => import('./pages/admin/AdminLists').then((m) => ({ default: m.AdminOrders })));
const AdminCoupons = lazy(() => import('./pages/admin/AdminLists').then((m) => ({ default: m.AdminCoupons })));
const AdminUsers = lazy(() => import('./pages/admin/AdminLists').then((m) => ({ default: m.AdminUsers })));
const AdminMessages = lazy(() => import('./pages/admin/AdminLists').then((m) => ({ default: m.AdminMessages })));
const AdminBookings = lazy(() => import('./pages/admin/AdminLists').then((m) => ({ default: m.AdminBookings })));

const Router = IS_PREVIEW ? HashRouter : BrowserRouter;
const STAFF = ['kitchen', 'admin'];

export default function App() {
  useEffect(() => { startMotion(); }, []);
  return (
    <Router>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <MenuProvider>
              <FavoritesProvider>
                <CartProvider>
                  <Suspense fallback={<Loading />}>
                    <Routes>
                      <Route element={<Layout />}>
                        <Route index element={<Home />} />
                        <Route path="menu" element={<Menu />} />
                        <Route path="menu/:id" element={<DishDetail />} />
                        <Route path="favorites" element={<Menu favOnly />} />
                        <Route path="cart" element={<Cart />} />
                        <Route path="checkout" element={<Protected roles={['customer']}><Checkout /></Protected>} />
                        <Route path="orders" element={<Protected roles={['customer']}><Orders /></Protected>} />
                        <Route path="orders/:id" element={<Protected><OrderDetail /></Protected>} />
                        <Route path="book" element={<Protected roles={['customer']}><Book /></Protected>} />
                        <Route path="login" element={<Login />} />
                        <Route path="account" element={<Protected><Account /></Protected>} />
                        <Route path="notifications" element={<Protected><Notifications /></Protected>} />
                        <Route path="about" element={<About />} />
                        <Route path="contact" element={<Contact />} />
                        <Route path="kitchen" element={<Protected roles={STAFF}><Kitchen /></Protected>} />
                        <Route path="admin" element={<Protected roles={['admin']}><AdminLayout /></Protected>}>
                          <Route index element={<Reports />} />
                          <Route path="menu" element={<AdminMenu />} />
                          <Route path="orders" element={<AdminOrders />} />
                          <Route path="coupons" element={<AdminCoupons />} />
                          <Route path="bookings" element={<AdminBookings />} />
                          <Route path="messages" element={<AdminMessages />} />
                          <Route path="users" element={<AdminUsers />} />
                        </Route>
                        <Route path="*" element={<NotFound />} />
                      </Route>
                    </Routes>
                  </Suspense>
                </CartProvider>
              </FavoritesProvider>
            </MenuProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </Router>
  );
}
