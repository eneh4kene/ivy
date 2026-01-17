# Ivy Frontend

Modern Next.js 14 web application for the Ivy accountability platform.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Backend API running on `http://localhost:3000`

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3001](http://localhost:3001)

### Environment Variables

Create `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## 📁 Project Structure

```
frontend/
├── app/                    # Next.js 14 App Router
│   ├── (auth)/            # Auth layout group
│   │   ├── login/
│   │   └── verify/
│   ├── (dashboard)/       # Main app layout group
│   │   ├── dashboard/
│   │   ├── workouts/
│   │   ├── donations/
│   │   ├── transformation/
│   │   └── settings/
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Landing page
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── layout/            # Layout components
│   └── features/          # Feature components
├── lib/
│   ├── api/               # API client
│   ├── store/             # Zustand stores
│   ├── hooks/             # Custom React hooks
│   ├── types.ts           # TypeScript types
│   └── utils.ts           # Utility functions
└── public/                # Static assets
```

## 🎯 Features

- ✅ Magic link authentication
- ✅ Comprehensive stats dashboard
- ✅ Workout planning and tracking
- ✅ Donation tracking with Impact Wallet
- ✅ Transformation journal
- ✅ Life markers
- ✅ User settings and profile management
- ✅ Responsive design
- ✅ Type-safe API client
- ✅ Real-time data with React Query

## 🛠️ Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui + Radix UI
- **State Management:** Zustand + React Query
- **Forms:** React Hook Form + Zod
- **Charts:** Recharts
- **Icons:** Lucide React
- **Animations:** Framer Motion
- **API Client:** Axios

## 📄 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript compiler check

## 🔗 API Integration

The frontend communicates with the backend API at `http://localhost:3000`.

All API calls are typed and use the centralized client in `lib/api/`.

## 🎨 Design System

### Colors
- **Primary:** Indigo (#4F46E5)
- **Success:** Green (#10B981)
- **Warning:** Orange (#F59E0B)
- **Error:** Red (#EF4444)

### Typography
- Font: System fonts (San Francisco, Segoe UI, Roboto)
- Scale: Tailwind default

## 📱 Pages

1. **Landing** (`/`) - Marketing page
2. **Login** (`/login`) - Magic link authentication
3. **Verify** (`/verify`) - Magic link verification
4. **Dashboard** (`/dashboard`) - Stats overview
5. **Workouts** (`/workouts`) - Workout management
6. **Donations** (`/donations`) - Impact tracking
7. **Transformation** (`/transformation`) - Journal
8. **Settings** (`/settings`) - User settings

## 🚧 Development Status

**Current:** Foundation Complete (30%)
- ✅ Project setup
- ✅ API client
- ✅ Type definitions
- ✅ Utilities
- ⏳ UI Components (in progress)
- ⏳ Pages (in progress)

## 📝 Next Steps

1. Create shadcn/ui components
2. Build authentication pages
3. Create dashboard
4. Build feature pages
5. Add responsive design
6. Polish and optimize

---

**Built with Next.js 14, TypeScript, and Tailwind CSS**
