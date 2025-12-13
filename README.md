<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1aONbxwddVKz_2Kq3_pjbo5tZwpc7hcRv

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy [.env.example](.env.example) to `.env.local` and set the secrets:
   - `VITE_GEMINI_API_KEY` for Google Gemini
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` if you want to connect to Supabase
3. Run the app:
   `npm run dev`
