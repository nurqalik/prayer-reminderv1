# Roe Bot 🌙

A sleek, modern Islamic companion app designed to keep you connected to your faith. Roe Bot combines accurate prayer timing with an AI-powered assistant, all wrapped in a minimalist "Sleek Zinc" aesthetic.

![Roe Bot Banner](./assets/splash-icon-dark2.png)

## ✨ Key Features

- 🕌 **Accurate Prayer Times** - Location-based timing with support for various calculation methods (Kemenag, MWL, ISNA, etc.).
- 🤖 **Roe AI Companion** - A knowledgeable Muslimah assistant powered by Google Gemini, providing friendly guidance and Islamic context.
- 📱 **Dynamic Home Screen Widgets** - Stay informed at a glance with "Next Prayer" and "Daily Schedule" widgets.
- 🔔 **Smart Notifications** - High-priority, lock-screen-ready reminders for every prayer.
- 🔐 **Privacy First (BYOK)** - "Bring Your Own Key" model. Your Gemini API key is stored securely on your device via `expo-secure-store`.
- 🌓 **Modern Dark Mode** - Seamless zinc-themed UI optimized for both light and dark environments.
- 📂 **Multimodal Chat** - Send images and documents to Roe for analysis via secure S3 uploads.

## 🛠️ Technical Stack

- **Framework:** [Expo](https://expo.dev/) / React Native (TypeScript)
- **Backend:** [tRPC](https://trpc.io/) with Next.js (Proxy Backend)
- **Database:** PostgreSQL (Prisma) for chat history, SQLite for local storage
- **AI Integration:** Google Gemini SDK
- **File Storage:** [UploadThing](https://uploadthing.com/)
- **State Management:** TanStack Query & React Context
- **Theming:** Minimalist Zinc CSS-in-JS

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (Preferred package manager)
- [Expo Go](https://expo.dev/go) or a development build

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/justroe/prayer-reminderv1.git
   cd prayer-reminderv1
   ```

2. Install dependencies:

   ```bash
   bun install
   ```

3. Set up environment variables:
   Copy `.env.example` to `.env` and fill in your tRPC backend URL.

4. Start the development server:
   ```bash
   bun start
   ```

## 🔐 Security & Privacy

Roe Bot is built with data sovereignty in mind:

- **API Keys:** Your Gemini API key is stored only in the device's **SecureStore**. It is never saved on our servers.
- **Local First:** Prayer schedules and completion states are stored locally in a high-performance KV-store.
- **Encrypted Transit:** All communications with the proxy backend are secured via HTTPS and JWT-based authentication.

## 🤝 Contributing

We welcome contributions! Please feel free to open issues or submit pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Made with ❤️ by [Roe Bot Team](https://github.com/nurqalik)
