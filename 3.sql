INSERT INTO calls (caller_number, receiver_number, accepted_at, status) VALUES
    ('+12345678901', '+19876543210', NOW(), 'missed'),
    ('+12345678902', '+19876543211', NOW(), 'missed'),
    ('+12345678903', '+19876543212', NOW(), 'missed'),
    ('+12345678904', '+19876543213', NOW(), 'accepted'),
    ('+12345678905', '+19876543214', NOW(), 'accepted'),
    ('+12345678906', '+19876543215', NOW(), 'accepted'),
    ('+12345678907', '+19876543216', NOW(), 'processed'),
    ('+12345678908', '+19876543217', NOW(), 'processed'),
    ('+12345678909', '+19876543218', NOW(), 'processed');


select * from calls