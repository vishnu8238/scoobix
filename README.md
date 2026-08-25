# Scoobix

Build a complete premium food delivery platform called Cravio.

The goal is to create a next-generation food delivery experience that feels more modern, faster, cleaner, and easier to use than existing food delivery apps.

IMPORTANT:

Build production-level UI/UX.

Do not create a basic clone.

Focus on simplicity, speed, and premium experience.

Keep the architecture scalable.

Make all screens functional with proper states.

Prepare backend integration using InsForge.

Do not use fake UI-only buttons. Every action should have proper flow.

BRAND IDENTITY:

App Name: Cravio

Primary Brand Color:
#28a156 (Fresh green)

Secondary Colors:
White
Soft gray
Dark charcoal text
Light green gradients

Design feeling:

Premium

Fresh

Trustworthy

Modern

Elegant

Easy for all age groups

Use:

Rounded cards

Soft shadows

Smooth animations

Clean spacing

Premium food photography

Modern typography

Glass effect where suitable

CUSTOMER MOBILE APP

Create these screens:

Splash Screen

Cravio logo animation

Smooth entrance animation

Premium food background

Home Screen

Top section:

User location selector

Profile icon

Notifications

Search bar

Search:
"Search restaurants, dishes, cuisines"

Main sections:

Hero banner:

Full width food promotion banner

Green gradient theme

Offer text

CTA button

Auto sliding carousel

Food categories:
Horizontal scroll cards:

Pizza

Burgers

Biryani

Desserts

Healthy

Beverages

More

Quick offers:
Cards:

Free delivery

Discounts

Combo offers

Restaurant discovery:

Cards should include:

Restaurant image

Logo

Name

Rating

Delivery time

Distance

Price range

Offer badge

Favorite button

Food recommendation:

Sections:

"Popular near you"

"Recommended for you"

"Trending dishes"

Food cards:

Include:

Image

Name

Rating

Price

Add button

Favorite

Restaurant Detail Page

Create premium restaurant profile:

Cover image

Restaurant name

Rating

Delivery time

Cuisine

Offers

Menu:

Categories:

Starters

Main course

Drinks

Desserts

Food item card:

Image

Description

Price

Add button

Customization popup

Cart

Create simple checkout:

Items

Quantity controls

Remove item

Coupon

Delivery fee

Taxes

Total amount

Large checkout button

Order Tracking

Create Uber-style tracking:

Live map area

Delivery partner card

Order timeline:

Order placed
Restaurant accepted
Preparing
Picked up
Delivered

Profile

Include:

Orders

Saved addresses

Payments

Favorites

Help

Settings

BOTTOM NAVIGATION:

5 tabs:

Home
Search
Cart
Orders
Profile

Use smooth animated transitions.

RESTAURANT PARTNER APP

Create separate professional dashboard.

Features:

Dashboard:

Today's revenue

Orders

Pending orders

Analytics

Order management:

New order notification

Actions:
Accept
Reject
Preparing
Ready

Menu management:

Add food

Edit food

Delete food

Availability toggle

Restaurant profile:

Images

Timing

Location

Offers

DELIVERY PARTNER APP

Create simple fast interface.

Features:

Home:

Online/offline toggle

Earnings

Completed deliveries

Delivery screen:

Customer location

Restaurant pickup

Navigation

Call button

Delivery status

Live location tracking.

Large buttons for easy usage.

MASTER ADMIN PANEL

Create SaaS style dashboard.

Include:

Overview:

Total users

Restaurants

Drivers

Orders

Revenue

Management:

Users
Restaurants
Drivers
Orders
Payments
Reports
Coupons

Use:

Sidebar navigation

Charts

Tables

Filters

BACKEND READY STRUCTURE:

Prepare for InsForge database:

Tables:

users
restaurants
drivers
menu_items
orders
order_items
payments
driver_tracking

Authentication:

Roles:

customer
restaurant_owner
driver
admin

Order workflow:

PLACED
ACCEPTED
PREPARING
READY
PICKED_UP
DELIVERED
CANCELLED

REALTIME:

Implement ready structure for:

Live order updates

Driver location updates

Restaurant notifications

FINAL UI REQUIREMENTS:

Make Cravio feel like a premium 2026 startup product.

Prioritize:

Fast ordering

Less clicks

Beautiful animations

Clean information hierarchy

Mobile first design

Professional launch-ready appearance

Do not make it look like a template.
Make it look like a real funded food delivery company app.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://scoobix.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/022038e5-5def-46ed-a7bd-9439cae1ea1d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
