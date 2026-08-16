# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Members of the Quality Control Unit at Streams of Joy Abuja use the product while carrying out attendance, reporting, and service-management responsibilities. Each signed-in member has a private personal profile.

## Product Purpose

The product gives the Quality Control Unit one secure workspace for member access, attendance, service reporting, and role-based operational tools. The personal profile lets each member keep their own identity and contact details accurate while seeing the access role currently assigned to them.

## Operating Context

Members authenticate with an email address tied to the official team register. The same identity is used for sessions, role assignments, service assignments, and report attribution. Administrators manage access roles; members manage their own profile details.

## Capabilities and Constraints

- Each signed-in member has a private **My Profile** page rather than a browsable member directory.
- Members can upload or replace a profile picture and edit their first, middle, and last names, email address, phone number, and birthday.
- Birthdays store and display only month and day; birth year is not collected.
- Department is not part of the member profile and must not be requested from members. The team operates as one unit.
- The member's current role is shown on the profile but remains read-only and administrator-controlled.
- Email changes require confirmation of the new address before it replaces the current login email. The system must keep authentication, roles, assignments, and reporting identity synchronized when the change completes.
- Profile images must be size-limited and optimized to minimize storage and bandwidth use on the free hosting stack. Persistent user uploads must not rely on Vercel's filesystem.
- Existing role vocabulary is General User, Service Manager, HOD, Admin, and Super Admin.

## Brand Commitments

The product is for the Quality Control Unit at Streams of Joy Abuja. Existing product terminology and the principle “Excellence is our culture” are established parts of the experience.

## Evidence on Hand

- The existing application contains member authentication, server-managed sessions, an official team register, administrator access management, and role assignment infrastructure.
- Existing application assets include the Streams of Joy Abuja / Quality Control Unit logo.
- No member profile-image collection currently exists.

## Product Principles

- Keep member identity accurate without exposing administrative access controls.
- Collect only information with a clear operational purpose.
- Treat email changes as verified identity migrations, not ordinary text edits.
- Preserve report and assignment history when profile information changes.
- Keep uploads lightweight enough for the project's free hosting and storage constraints.

## Accessibility & Inclusion

Profile editing must work on mobile and desktop, support keyboard operation, expose clear labels and validation feedback, and not rely on profile photos as the only way to identify a member.
