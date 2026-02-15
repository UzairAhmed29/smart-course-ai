from flask import Flask, render_template, request, jsonify
import sqlite3
import pandas as pd
from datetime import datetime
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret_key'

# database setup
DATABASE = 'smart_course.db'

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
            query TEXT NOT NULL,
            model_type TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )    
    ''')

    # create saved_recommendations table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS saved_recommendations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            search_id INTEGER,
            course_id INTEGER,
            course_name TEXT,
            skills TEXT,
            description TEXT,
            score REAL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (search_id) REFERENCES search_history (id)
        )
    ''')

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

if __name__ == '__main__':
    if not os.path.exists(DATABASE):
        init_db()

    app.run(debug=True)