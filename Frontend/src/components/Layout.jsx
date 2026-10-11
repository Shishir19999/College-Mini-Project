import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import Icon from './Icon';
import { Loading } from './Common';
import { useAuth, useCart, useTheme } from '../context/contexts';
import { api } from '../api';

const BASE = import.meta.env.BASE_URL;

function navFor(role) {
  const links = [['/', 'Home', true], ['/menu', 'Menu']];
  if (!role || role === 'customer') links.push(['/favorites', 'Favorites'], ['/orders', 'Orders'], ['/book', 'Book a table']);
  if (role === 'kitchen' || role === 'admin') links.push(['/kitchen', 'Kitchen']);
  if (role === 'admin') links.push(['/admin', 'Admin']);
  links.push(['/about', 'About'], ['/contact', 'Contact']);
  return links;
}

export function Header() {
  const { user, unread } = useAuth();
  const { count } = useCart();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  const staff = user && user.role !== 'customer';
  return (
    <header className="site-header">
      <div className="container bar">
        <Link className="brand" to="/"><img src={`${BASE}food/logo.png`} alt="" width="36" height="36" /><span>Online FoodShop</span></Link>
        <nav className={`nav ${open ? 'open' : ''}`} id="site-nav" aria-label="Main">
          {navFor(user?.role).map(([to, label, end]) => <NavLink key={to} to={to} end={end}>{label}</NavLink>)}
        </nav>
        <div className="tools">
          <Link className="icon-btn" to={user ? '/account' : '/login'} aria-label={user ? `Account: ${user.name}` : 'Log in or register'} title={user ? user.name : 'Log in'}><Icon name="user" /></Link>
          {user && (
            <Link className="icon-btn" to="/notifications" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
              <Icon name="bell" />{unread > 0 && <span className="badge" aria-hidden="true">{unread}</span>}
            </Link>
          )}
          {!staff && (
            <Link className="icon-btn" to="/cart" aria-label={count ? `Cart, ${count} items` : 'Cart'}>
              <Icon name="cart" />{count > 0 && <span className="badge" aria-hidden="true">{count}</span>}
            </Link>
          )}
          <button type="button" className="icon-btn" onClick={toggle} aria-pressed={theme === 'dark'} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}><Icon name="moon" /></button>
          <button type="button" className="icon-btn menu-toggle" aria-expanded={open} aria-controls="site-nav" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((o) => !o)}><Icon name="menu" /></button>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const { user } = useAuth();
  return (
    <footer className="site-footer">
      <div className="container foot">
        <div><strong>Online FoodShop</strong><br /><span className="muted">Fresh food, fair prices. A college mini project.</span>
          {api.isPreview && <><br /><span className="muted">Live preview: everything runs in your browser and is saved on this device.</span></>}</div>
        <ul>
          <li><Link to="/menu">Menu</Link></li>
          {(!user || user.role === 'customer') && <li><Link to="/cart">Cart</Link></li>}
          {(!user || user.role === 'customer') && <li><Link to="/orders">Orders</Link></li>}
          <li><Link to="/contact">Contact</Link></li>
        </ul>
      </div>
    </footer>
  );
}

export default function Layout() {
  const loc = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  return (
    <>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); const m = document.getElementById('main'); m?.focus(); m?.scrollIntoView(); }}>Skip to content</a>
      <Header />
      <main id="main" tabIndex={-1}><Outlet /></main>
      <Footer />
    </>
  );
}

// Redirect to the login page unless the signed-in user has one of the roles.
export function Protected({ roles, children }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <Loading label="Checking your session" />;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={user.role === 'customer' ? '/' : user.role === 'kitchen' ? '/kitchen' : '/admin'} replace />;
  return children;
}
