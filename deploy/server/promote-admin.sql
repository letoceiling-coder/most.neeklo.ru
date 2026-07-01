UPDATE users SET role = 'admin' WHERE email = 'dsc-23@yandex.ru';
SELECT email, role FROM users ORDER BY created_at;
