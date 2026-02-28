from flask import Flask, render_template, request, jsonify
import sqlite3
import pandas as pd
from datetime import datetime
import os
from dotenv import load_dotenv
from recommender import get_recommender
import logging

logging.basicConfig(
    level=logging.DEBUG,  # capture everything
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    handlers=[
        logging.FileHandler("logs/debug.log"),   # write to file
        logging.StreamHandler()             # print to console
    ]
)

logger = logging.getLogger(__name__)

load_dotenv()
current_time = datetime.now()
# dev keys
# import secrets
# print(secrets.token_hex(16))

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv("APP_SECRET")

# database setup
DATABASE = os.getenv("DATABASE_NAME")

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize database with required tables"""
    conn    = get_db_connection()
    cursor  = conn.cursor()

    # create search_history table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS search_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            query TEXT NOT NULL,
            model_type TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )    
    ''')

    # create saved_recommendations table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS saved_recommendations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            search_id INTEGER,
            course_id INTEGER,
            course_name TEXT,
            difficulty_level TEXT,
            university TEXT,
            rating TEXT,
            skills TEXT,
            description TEXT,
            score REAL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (search_id) REFERENCES search_history (id)
        )
    ''')

    # Safely try to add session_id if table already exists dynamically
    try:
        cursor.execute('ALTER TABLE search_history ADD COLUMN session_id TEXT')
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute('ALTER TABLE saved_recommendations ADD COLUMN session_id TEXT')
    except sqlite3.OperationalError:
        pass

    conn.commit()
    conn.close()
    print("Database initialized successfully.")

# routes
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/recommend')
def recommend():
    return render_template('recommendations.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/about')
def about():
    return render_template('about.html')

# API Routes
@app.route('/api/recommend', methods=['POST'])
def api_recommend():
    """Handle recommendation requests"""
    try:
        data = request.get_json()
        query = data.get('query', '').strip()
        model_type = data.get('model', 'tfidf')
        
        if not query:
            return jsonify({'error': 'Query is required'}), 400
        
        # Get recommender instance
        recommender = get_recommender()
        
        # Get recommendations
        recommendations = recommender.get_recommendations(
            query=query,
            model_type=model_type,
            top_n=10
        )
        
        session_id = data.get('session_id', 'unknown')
        
        # Save to search history
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO search_history (session_id, query, model_type, timestamp) VALUES (?, ?, ?, ?)',
            (session_id, query, model_type, current_time)
        )
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'recommendations': recommendations,
            'model': model_type,
            'query': query
        })
        
    except Exception as e:
        print(f"Error in recommend API: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/save', methods=['POST'])
def api_save():
    """Save a course recommendation"""
    try:
        data = request.get_json()
        
        session_id = data.get('session_id', 'unknown')
        course_id = data.get('course_id')
        course_name = data.get('course_name')
        rating = data.get('rating')
        difficulty_level = data.get('difficulty_level')
        university = data.get('university')
        skills = data.get('skills')
        description = data.get('description')
        score = data.get('score')
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get the most recent search_id for this session
        cursor.execute('SELECT id FROM search_history WHERE session_id = ? ORDER BY id DESC LIMIT 1', (session_id,))
        result = cursor.fetchone()
        search_id = result['id'] if result else None
        
        # Save the recommendation
        cursor.execute('''
            INSERT INTO saved_recommendations 
            (session_id, search_id, course_id, course_name, rating, difficulty_level, university, skills, description, score, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (session_id, search_id, course_id, course_name, rating, difficulty_level, university, skills, description, score, current_time))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Course saved successfully'})
        
    except Exception as e:
        print(f"Error in save API: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/compare', methods=['GET'])
def api_compare():
    """Compare TFIDF and Neural models for a query"""
    try:
        query = request.args.get('query')
        if not query:
            return jsonify({'error': 'No query provided'}), 400
        
        recommender = get_recommender()
        results = recommender.compare_models(query)
        return jsonify({
            'success': True,
            'tfidf': results['tfidf'],
            'neural': results['neural']
        })
    except Exception as e:
        logger.error(f'Error comparing: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/history', methods=['GET'])
def api_history():
    """Get search history and saved recommendations per session"""
    try:
        session_id = request.args.get('session_id', 'unknown')
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get search history
        cursor.execute('''
            SELECT id, query, model_type, 
                   strftime('%Y-%m-%d %H:%M', timestamp) as timestamp
            FROM search_history 
            WHERE session_id = ?
            ORDER BY id DESC 
            LIMIT 20
        ''', (session_id,))
        search_history = [dict(row) for row in cursor.fetchall()]
        
        # Group saved recommendations by search session
        cursor.execute('''
            SELECT r.id, r.search_id, r.course_id, r.course_name, r.skills, r.description, r.score, r.difficulty_level, r.university,
                   strftime('%Y-%m-%d %H:%M', r.timestamp) as timestamp, h.query
            FROM saved_recommendations r
            LEFT JOIN search_history h ON r.search_id = h.id
            WHERE r.session_id = ?
            ORDER BY r.id DESC
        ''', (session_id,))
        saved_courses = [dict(row) for row in cursor.fetchall()]
        
        session_groups = {}
        for sc in saved_courses:
            s_query = sc['query'] or 'Unknown Session'
            if s_query not in session_groups:
                session_groups[s_query] = []
            session_groups[s_query].append(sc)
            
        # Get statistics
        cursor.execute('SELECT COUNT(*) as count FROM search_history WHERE session_id = ?', (session_id,))
        total_searches = cursor.fetchone()['count']
        
        cursor.execute('SELECT COUNT(*) as count FROM saved_recommendations WHERE session_id = ?', (session_id,))
        total_saved = cursor.fetchone()['count']
        
        cursor.execute('''
            SELECT COUNT(*) as count FROM search_history 
            WHERE session_id = ? AND DATE(timestamp) = DATE('now')
        ''', (session_id,))
        recent_count = cursor.fetchone()['count']
        
        conn.close()
        
        return jsonify({
            'success': True,
            'search_history': search_history,
            'saved_courses': session_groups,
            'total_searches': total_searches,
            'total_saved': total_saved,
            'recent_count': recent_count
        })
        
    except Exception as e:
        print(f"Error in history API: {e}")
        return jsonify({'error': str(e)}), 500
    
if __name__ == '__main__':
    if not os.path.exists(DATABASE):
        init_db()

    app.run(debug=True)