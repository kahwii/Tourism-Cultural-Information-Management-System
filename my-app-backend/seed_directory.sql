-- ============================================================
--  Seed data for the Directory modules (run once in phpMyAdmin)
--  Tables: restaurants, hotels, tourism_businesses
--  Safe to re-run: clears each table first.
-- ============================================================
USE tcims_db;

-- ---------- RESTAURANTS (MICHELIN Guide — Mandaluyong) ----------
TRUNCATE TABLE restaurants;
INSERT INTO restaurants (name, cuisine, address, status) VALUES
('Now Now',                      'Contemporary',         'PP - Mandaluyong, Metro Manila',  'Active'),
('Juniper',                      'Contemporary',         'PP - Mandaluyong, Metro Manila',  'Active'),
('Cantabria by Chele Gonzalez',  'Spanish',              'PPP - Mandaluyong, Metro Manila', 'Active'),
('Summer Palace',                'Chinese',              'PPP - Mandaluyong, Metro Manila', 'Active'),
('Osteria Antica',               'Italian Contemporary', 'PP - Mandaluyong, Metro Manila',  'Active');

-- ---------- HOTELS / LODGING ----------
TRUNCATE TABLE hotels;
INSERT INTO hotels (name, type, address, status) VALUES
('Hotel Sogo EDSA',             'Budget',   'EDSA, Mandaluyong City',            'Active'),
('Hop Inn Hotel Pioneer',       'Budget',   'Pioneer St., Mandaluyong City',     'Active'),
('The Originas Boutique Hotel', 'Boutique', 'Boni Avenue, Mandaluyong City',     'Active'),
('RedDoorz Plus',               'Budget',   'Shaw Blvd., Mandaluyong City',      'Active'),
('Privato Hotel Ortigas',       'Business', 'Wack-Wack, Mandaluyong City',       'Active');

-- ---------- TOURISM BUSINESSES ----------
TRUNCATE TABLE tourism_businesses;
INSERT INTO tourism_businesses (name, type, address, status) VALUES
('SM Megamall',           'Shopping Mall',       'EDSA cor. Dona Julia Vargas Ave., Wack-Wack', 'Active'),
('Shangri-La Plaza Mall', 'Shopping Mall',       'EDSA cor. Shaw Blvd., Wack-Wack',             'Active'),
('The Podium',            'Shopping Mall',       'ADB Ave., Wack-Wack, Mandaluyong City',       'Active'),
('Greenfield District',   'Commercial Complex',  'Highway Hills, Mandaluyong City',             'Active'),
('Mandala Park',          'Commercial Complex',  'Shaw Blvd., Mandaluyong City',                'Active'),
('Robinsons Forum',       'Shopping Mall',       'EDSA cor. Pioneer St., Mandaluyong City',     'Active');
