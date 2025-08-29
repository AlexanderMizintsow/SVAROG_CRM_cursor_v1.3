// server-endpoint.js - Серверный эндпоинт для Node.js/Express

const express = require('express');
const { Pool } = require('pg');

// Настройка подключения к PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER || 'your_username',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'your_database',
  password: process.env.DB_PASSWORD || 'your_password',
  port: process.env.DB_PORT || 5432,
});

/**
 * Эндпоинт для получения статистики рейтингов рекламаций
 * GET /api/reclamation-ratings-stats
 */
const getReclamationRatingsStats = async (req, res) => {
  try {
    const client = await pool.connect();
    
    try {
      // Получаем общую статистику
      const overviewQuery = `
        SELECT 
          COUNT(*) as total_ratings,
          AVG(rating::numeric) as average_rating,
          MAX(rated_at) as last_updated
        FROM reclamation_ratings 
        WHERE rated_at >= NOW() - INTERVAL '30 days'
      `;
      
      const overviewResult = await client.query(overviewQuery);
      const overview = overviewResult.rows[0];

      // Получаем все рейтинги за последние 30 дней для распределения
      const ratingsQuery = `
        SELECT rating 
        FROM reclamation_ratings 
        WHERE rated_at >= NOW() - INTERVAL '30 days'
        ORDER BY rated_at DESC
      `;
      
      const ratingsResult = await client.query(ratingsQuery);
      const ratings = ratingsResult.rows.map(row => row.rating);

      // Получаем статистику по пользователям
      const dealersQuery = `
        SELECT 
          user_id,
          user_name,
          COUNT(*) as total_ratings,
          AVG(rating::numeric) as average_rating
        FROM reclamation_ratings 
        WHERE rated_at >= NOW() - INTERVAL '30 days'
        GROUP BY user_id, user_name
        HAVING COUNT(*) > 0
        ORDER BY average_rating DESC, total_ratings DESC
      `;
      
      const dealersResult = await client.query(dealersQuery);
      const dealers = dealersResult.rows.map(row => ({
        id: row.user_id,
        user_id: row.user_id,
        user_name: row.user_name,
        name: row.user_name,
        totalRatings: parseInt(row.total_ratings),
        averageRating: parseFloat(row.average_rating),
        period: '30 дней'
      }));

      // Формируем ответ
      const response = {
        overview: {
          totalRatings: parseInt(overview.total_ratings) || 0,
          averageRating: parseFloat(overview.average_rating) || 0,
          period: '30 дней',
          lastUpdated: overview.last_updated
        },
        ratings: ratings,
        dealers: dealers
      };

      res.json(response);
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Ошибка при получении статистики рейтингов:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      message: error.message
    });
  }
};

/**
 * Пример использования в Express приложении:
 * 
 * const express = require('express');
 * const cors = require('cors');
 * const app = express();
 * 
 * app.use(cors());
 * app.use(express.json());
 * 
 * // Подключаем эндпоинт
 * app.get('/api/reclamation-ratings-stats', getReclamationRatingsStats);
 * 
 * app.listen(5004, () => {
 *   console.log('Сервер запущен на порту 5004');
 * });
 */

module.exports = {
  getReclamationRatingsStats
};

// Дополнительные функции для других типов процессов:

/**
 * Шаблон для создания эндпоинта для нового типа процесса
 * Замените 'your_table_name' на название вашей таблицы
 */
const getCustomProcessStats = async (req, res, tableName) => {
  try {
    const client = await pool.connect();
    
    try {
      // Адаптируйте запросы под структуру вашей таблицы
      const overviewQuery = `
        SELECT 
          COUNT(*) as total_ratings,
          AVG(rating::numeric) as average_rating,
          MAX(created_at) as last_updated
        FROM ${tableName}
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `;
      
      const overviewResult = await client.query(overviewQuery);
      const overview = overviewResult.rows[0];

      const ratingsQuery = `
        SELECT rating 
        FROM ${tableName}
        WHERE created_at >= NOW() - INTERVAL '30 days'
        ORDER BY created_at DESC
      `;
      
      const ratingsResult = await client.query(ratingsQuery);
      const ratings = ratingsResult.rows.map(row => row.rating);

      const dealersQuery = `
        SELECT 
          user_id,
          user_name,
          COUNT(*) as total_ratings,
          AVG(rating::numeric) as average_rating
        FROM ${tableName}
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY user_id, user_name
        HAVING COUNT(*) > 0
        ORDER BY average_rating DESC, total_ratings DESC
      `;
      
      const dealersResult = await client.query(dealersQuery);
      const dealers = dealersResult.rows.map(row => ({
        id: row.user_id,
        user_id: row.user_id,
        user_name: row.user_name,
        name: row.user_name,
        totalRatings: parseInt(row.total_ratings),
        averageRating: parseFloat(row.average_rating),
        period: '30 дней'
      }));

      const response = {
        overview: {
          totalRatings: parseInt(overview.total_ratings) || 0,
          averageRating: parseFloat(overview.average_rating) || 0,
          period: '30 дней',
          lastUpdated: overview.last_updated
        },
        ratings: ratings,
        dealers: dealers
      };

      res.json(response);
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error(`Ошибка при получении статистики для ${tableName}:`, error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      message: error.message
    });
  }
};

// Экспорт шаблона для новых процессов
module.exports.getCustomProcessStats = getCustomProcessStats;