# CDPA Compliance System - Deployment Guide

## IMPORTANT: Your App Doesn't Need a Build Tool!

Your frontend uses **plain HTML, CSS, and JavaScript** - no build step required! The Express backend serves the frontend files directly from the `/frontend` directory.

## Option 1: Deploy to Render (What You're Trying Now)

1. **Push your code to GitHub/GitLab/Bitbucket**
   - Make sure to commit `render.yaml`, `package.json`, and all your code

2. **Sign up for Render**
   - Go to https://render.com and create a free account
   - Connect your GitHub account

3. **Create a New Web Service**
   - Click "New +" → "Web Service"
   - Select your repository
   - Set these options:
     - **Name**: cdpa-compliance-system (or whatever you want)
     - **Runtime**: Node
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Plan**: Free
   - **IMPORTANT**: Leave the "Publish Directory" BLANK (don't set it to anything!)

4. **Add Environment Variables**
   - Scroll down to "Environment"
   - Add these variables (get a free PostgreSQL database first - see below):
     - `DB_HOST` (your PostgreSQL database host)
     - `DB_PORT` (usually 5432)
     - `DB_NAME` (database name)
     - `DB_USER` (database username)
     - `DB_PASS` (database password)
     - `JWT_SECRET` (a long random string - you can generate one at https://generate-secret.vercel.app/)
     - `NODE_ENV` = "production"

5. **Click "Create Web Service"**
   - Wait for it to deploy - that's it!

## Option 2: Deploy to Vercel (Recommended, Free)

1. **Push your code to GitHub/GitLab/Bitbucket**
   - Create a repository
   - Commit and push your code

2. **Sign up for Vercel**
   - Go to https://vercel.com and create a free account
   - Connect your GitHub account

3. **Import your project**
   - Click "New Project" on Vercel
   - Select your repository
   - Keep the default settings
   - Click "Deploy"

4. **Add Environment Variables**
   - In your Vercel project settings, go to "Environment Variables"
   - Add the same variables as for Render

## Get a Free PostgreSQL Database

You need a managed PostgreSQL database for production. Here are free options:

1. **Neon (Recommended)**: https://neon.tech
2. **Supabase**: https://supabase.com
3. **Render PostgreSQL**: You can create a free PostgreSQL database directly on Render!

## Important Notes

- **No Build Tool Needed**: Your frontend is plain HTML/CSS/JS - don't set a publish directory!
- **Database**: You'll need a managed PostgreSQL database for production (don't use local PostgreSQL)
- **File Uploads**: The uploads directory won't persist on serverless platforms - consider using cloud storage (S3, Cloudinary)
- **Security**: Change all default passwords before going live!

## Default Login Credentials (Change These Immediately!)

- System Administrator: admin / admin123
- Data Protection Officer: dpo_officer / dpo123
