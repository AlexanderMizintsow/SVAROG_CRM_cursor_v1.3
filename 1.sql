select * from dealers

select * from companies


DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;








SELECT 
    c.id, 
    c.name_companies, 
    c.status_companies, 
    c.seller_code, 
    c.trade_brand,
    CONCAT(u1.last_name, ' ', u1.first_name, ' ', u1.middle_name) AS regional_manager_name,
    CONCAT(u2.last_name, ' ', u2.first_name, ' ', u2.middle_name) AS mpp_name,
    CONCAT(u3.last_name, ' ', u3.first_name, ' ', u3.middle_name) AS mpr_name,
    CONCAT(u4.last_name, ' ', u4.first_name, ' ', u4.middle_name) AS replacing_mpr_name,
    CONCAT(u5.last_name, ' ', u5.first_name, ' ', u5.middle_name) AS replacing_mpp_name,
    c.has_availability, 
    c.has_warehouse, 
    c.document_transfer_department, 
    c.is_self_service, 
    c.created_at, 
    c.updated_at,
    -- Добавляем поля из таблицы адресов компании
    ca.region, ca.city, ca.street, ca.building, ca.is_primary AS is_primary_address, ca.comment AS address_comment,
    -- Добавляем поля из таблицы значимых дат
    id.date_name, id.event_date,
    -- Добавляем поля из таблицы способов оповещения
    nm.method_name,
    -- Добавляем поля из таблицы условий доставки
    dt.term_name, dt.term_comment,
    -- Добавляем поля из таблицы социальных сетей
    sn.network_name, sn.comment AS social_comment,
    -- Добавляем данные о подъеме на этаж
    fr.is_paid, fr.comment AS floor_rising_comment,
    -- Добавляем поля из таблицы сопутствующей деятельности
    ra.activity_name,
    -- Добавляем поля из договоров компании
    ct.contract_name,
    -- Добавляем поля из отраслей компании
    ci.industry_name,
    -- Добавляем поля из телефонных номеров
    pn.phone_number,
    -- Добавляем поля из электронных почт компании
    ec.email,
    -- Добавляем поля о конкурентах компании
    CASE WHEN dc.has_representation THEN 'Yes' ELSE 'No' END AS competitor_representation,
    comp.name AS competitor_name,
    comp.industry AS competitor_industry,
    comp.contact_email AS competitor_contact_email
FROM companies c
LEFT JOIN users u1 ON u1.id = c.regional_manager_id
LEFT JOIN users u2 ON u2.id = c.mpp_id
LEFT JOIN users u3 ON u3.id = c.mpr_id
LEFT JOIN replacing_mpr rmpr ON rmpr.company_id = c.id
LEFT JOIN users u4 ON u4.id = rmpr.user_id
LEFT JOIN replacing_mpp rmpp ON rmpp.company_id = c.id
LEFT JOIN users u5 ON u5.id = rmpp.user_id
LEFT JOIN company_addresses ca ON ca.company_id = c.id
LEFT JOIN important_dates id ON id.company_id = c.id
LEFT JOIN notification_methods nm ON nm.company_id = c.id
LEFT JOIN delivery_terms dt ON dt.company_id = c.id
LEFT JOIN social_networks sn ON sn.company_id = c.id
LEFT JOIN floor_rising fr ON fr.company_id = c.id
LEFT JOIN related_activities ra ON ra.company_id = c.id
LEFT JOIN contracts ct ON ct.company_id = c.id
LEFT JOIN company_industries ci ON ci.company_id = c.id
LEFT JOIN phone_numbers_companies pn ON pn.company_id = c.id
LEFT JOIN emails_companies ec ON ec.company_id = c.id
LEFT JOIN dealer_competitors dc ON dc.company_id = c.id
LEFT JOIN competitors comp ON comp.id = dc.competitor_id;

