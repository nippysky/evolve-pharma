/**
 * ENVOLVE PHARMACEUTICALS — Icon Set
 *
 * We re-export Lucide icons under our internal naming convention so the
 * rest of the app imports `from '@/components/icons'` and never knows
 * which underlying library is in play. Swap-friendly: change this file
 * to use Phosphor, Tabler, Radix Icons, or hand-built SVGs without
 * touching a single component.
 *
 * All icons accept a `size` prop (defaults to 16) plus standard SVG
 * props. They inherit `currentColor`, so colorize via `color: …` on the
 * parent.
 */

import {
  // navigation / arrows
  ArrowRight as LRArrowRight,
  ArrowUpRight as LRArrowUpRight,
  ArrowLeft as LRArrowLeft,
  ChevronDown as LRChevronDown,
  ChevronRight as LRChevronRight,
  ChevronLeft as LRChevronLeft,
  ChevronUp as LRChevronUp,
  ChevronsUpDown as LRChevronsUpDown,
  // controls
  Check as LRCheck,
  X as LRX,
  Plus as LRPlus,
  Minus as LRMinus,
  Search as LRSearch,
  Filter as LRFilter,
  ListFilter as LRListFilter,
  Upload as LRUpload,
  Download as LRDownload,
  Eye as LREye,
  EyeOff as LREyeOff,
  Trash2 as LRTrash,
  Pencil as LREdit,
  RotateCw as LRRotateCw,
  Menu as LRMenu,
  MoreHorizontal as LRMoreH,
  MoreVertical as LRMoreV,
  Tag as LRTag,
  // brand / domain
  Bell as LRBell,
  User as LRUser,
  Users as LRUsers,
  Building2 as LRBuilding,
  Pill as LRPill,
  Package as LRBox,
  Boxes as LRBoxes,
  Truck as LRTruck,
  LayoutDashboard as LRDashboard,
  Settings as LRSettings,
  BarChart3 as LRChart,
  LogOut as LRLogout,
  ShoppingBasket as LRBasket,
  // contact
  Mail as LRMail,
  Phone as LRPhone,
  MapPin as LRMapPin,
  Send as LRSend,
  Lock as LRLock,
  // trust / status
  ShieldCheck as LRShield,
  Sparkles as LRSparkle,
  Star as LRStar,
  Info as LRInfoCircle,
  AlertTriangle as LRAlertTriangle,
  CheckCircle2 as LRCheckCircle,
  XCircle as LRXCircle,
  Calendar as LRCalendar,
  Clock as LRClock,
  Loader2 as LRSpinner,
  // extras used in pages
  CreditCard as LRCreditCard,
  FileText as LRFileText,
  HelpCircle as LRHelpCircle,
  Leaf as LRLeaf,
  TrendingUp as LRTrendingUp,
  TrendingDown as LRTrendingDown,
  ClipboardList as LRClipboardList,
  ShoppingCart as LRShoppingCart,
  type LucideProps,
} from 'lucide-react';
import type { ComponentType } from 'react';

export type IconProps = LucideProps & {
  /** Pixel size; sets both width and height. */
  size?: number;
};

// Wrap each lucide icon so default size = 16 and strokeWidth = 1.75 ----
// (Lucide's default 24/2 reads heavy in dense UI.)
function wrap(
  LR: ComponentType<LucideProps>,
  defaults: Partial<LucideProps> = {},
): (props: IconProps) => React.JSX.Element {
  const C = ({ size = 16, strokeWidth = 1.75, ...rest }: IconProps) => (
    <LR size={size} strokeWidth={strokeWidth} {...defaults} {...rest} />
  );
  C.displayName = `Icon(${(LR as { displayName?: string }).displayName ?? 'Lucide'})`;
  return C;
}

// ---------- Public icon set --------------------------------------------

export const ArrowRight = wrap(LRArrowRight);
export const ArrowUpRight = wrap(LRArrowUpRight);
export const ArrowLeft = wrap(LRArrowLeft);
export const ChevronDown = wrap(LRChevronDown);
export const ChevronRight = wrap(LRChevronRight);
export const ChevronLeft = wrap(LRChevronLeft);
export const ChevronUp = wrap(LRChevronUp);
export const ChevronsUpDown = wrap(LRChevronsUpDown);

export const Check = wrap(LRCheck);
export const X = wrap(LRX);
export const Plus = wrap(LRPlus);
export const Minus = wrap(LRMinus);
export const Search = wrap(LRSearch);
export const Filter = wrap(LRFilter);
export const ListFilter = wrap(LRListFilter);
export const Upload = wrap(LRUpload);
export const Download = wrap(LRDownload);
export const Eye = wrap(LREye);
export const EyeOff = wrap(LREyeOff);
export const Trash = wrap(LRTrash);
export const Edit = wrap(LREdit);
export const RotateCw = wrap(LRRotateCw);
export const Menu = wrap(LRMenu);
export const MoreH = wrap(LRMoreH);

export const Bell = wrap(LRBell);
export const User = wrap(LRUser);
export const Users = wrap(LRUsers);
export const Building = wrap(LRBuilding);
export const Pill = wrap(LRPill);
export const Box = wrap(LRBox);
export const Boxes = wrap(LRBoxes);
export const Truck = wrap(LRTruck);
export const Dashboard = wrap(LRDashboard);
export const Settings = wrap(LRSettings);
export const Chart = wrap(LRChart);
export const Logout = wrap(LRLogout);
export const Basket = wrap(LRBasket);

export const Mail = wrap(LRMail);
export const Phone = wrap(LRPhone);
export const MapPin = wrap(LRMapPin);
export const Send = wrap(LRSend);
export const Lock = wrap(LRLock);

export const Shield = wrap(LRShield);
export const Sparkle = wrap(LRSparkle);
export const Star = wrap(LRStar);
export const InfoCircle = wrap(LRInfoCircle);
export const AlertTriangle = wrap(LRAlertTriangle);
export const CheckCircle = wrap(LRCheckCircle);
export const XCircle = wrap(LRXCircle);
export const Calendar = wrap(LRCalendar);
export const Clock = wrap(LRClock);
export const Spinner = wrap(LRSpinner);
export const CreditCard = wrap(LRCreditCard);
export const FileText = wrap(LRFileText);
export const HelpCircle = wrap(LRHelpCircle);
export const Leaf = wrap(LRLeaf);
export const TrendingUp = wrap(LRTrendingUp);
export const TrendingDown = wrap(LRTrendingDown);
export const ClipboardList = wrap(LRClipboardList);
export const ShoppingCart = wrap(LRShoppingCart);
export const MoreV = wrap(LRMoreV);
export const Tag = wrap(LRTag);

// ---------- Registry / dispatcher --------------------------------------

export const Icons = {
  ArrowRight,
  ArrowUpRight,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronsUpDown,
  Check,
  X,
  Plus,
  Minus,
  Search,
  Filter,
  ListFilter,
  Upload,
  Download,
  Eye,
  EyeOff,
  Trash,
  Edit,
  RotateCw,
  Menu,
  MoreH,
  Bell,
  User,
  Users,
  Building,
  Pill,
  Box,
  Boxes,
  Truck,
  Dashboard,
  Settings,
  Chart,
  Logout,
  Basket,
  Mail,
  Phone,
  MapPin,
  Send,
  Lock,
  Shield,
  Sparkle,
  Star,
  InfoCircle,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
  Clock,
  Spinner,
  CreditCard,
  FileText,
  HelpCircle,
  Leaf,
  TrendingUp,
  TrendingDown,
  ClipboardList,
  ShoppingCart,
  MoreV,
  Tag,
} as const;

export type IconName = keyof typeof Icons;

export function Icon({ name, ...props }: { name: IconName } & IconProps) {
  const C = Icons[name];
  return <C {...props} />;
}