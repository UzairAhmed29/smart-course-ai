
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer
import joblib
import os
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

import re

def clean_text(text):
    if not isinstance(text, str):
        return ""
    text = text.replace('\t', ' ').replace('\n', ' ').replace('\r', '').replace('', '')
    text = re.sub(r'\?{2,}', '?', text)
    return text.strip()

class CourseRecommender:
    def __init__(self, data_path='data/courses.csv'):
        """Initialize the recommender system"""
        self.data_path = data_path
        self.tfidf_vectorizer = None
        self.df = None
        self.tfidf_vectorizer = None
        self.tfidf_matrix = None
        self.neural_model = None
        self.course_embeddings = None

         # Load data and models
        self.load_data()
        self.initialize_tfidf_model()
        self.initialize_neural_model()

    def load_data(self):
        """Load course data from CSV"""
        try:
            self.df = pd.read_csv(self.data_path)
            print(f"Loaded {len(self.df)} courses from dataset")
        except Exception as e:
            print(f"Error loading data: {e}")
            raise

    def initialize_tfidf_model(self):
        """Initialize TF-IDF model"""
        try:
            self.df.columns = (
                self.df.columns
                    .str.strip()
                    .str.lower()
                    .str.replace(" ", "_")
            )

            print("Initializing TF-IDF model...")
            # Combine course name and description for better matching
            self.df['combined_text'] = self.df['course_name'] + ' ' + self.df['course_description']
            
            # Create TF-IDF vectorizer
            self.tfidf_vectorizer = TfidfVectorizer(
                max_features=1000,
                stop_words='english',
                ngram_range=(1, 2),  # Use unigrams and bigrams
                min_df=1
            )
            
            # Fit and transform the course descriptions
            self.tfidf_matrix = self.tfidf_vectorizer.fit_transform(self.df['combined_text'])
            print("TF-IDF model initialized successfully!")
            
        except Exception as e:
            print(f"Error initializing TF-IDF model: {e}")
            raise

    def initialize_neural_model(self):
        """Initialize Neural Sentence Transformer model"""
        try:
            print("Initializing Neural model (this may take a moment)...")
            # Load pre-trained sentence transformer model
            self.neural_model = SentenceTransformer('all-MiniLM-L6-v2')
            
            embeddings_file = 'data/course_embeddings.npy'
            if os.path.exists(embeddings_file):
                print("Loading cached course embeddings...")
                self.course_embeddings = np.load(embeddings_file)
            else:
                print("Generating embeddings...")
                course_texts = self.df['combined_text'].tolist()
                self.course_embeddings = self.neural_model.encode(
                    course_texts,
                    convert_to_tensor=False,
                    show_progress_bar=True
                )
                # save for later
                os.makedirs('data', exist_ok=True)
                np.save(embeddings_file, self.course_embeddings)
            
            print("Neural model initialized successfully!")
            
        except Exception as e:
            print(f"Error initializing Neural model: {e}")
            raise

    def compare_models(self, query):
        """
        Compare TF-IDF vs Neural for the same query 
        and return results with explanations.
        """
        import re
        tfidf_results = self.recommend_tfidf(query, top_n=3)
        neural_results = self.recommend_neural(query, top_n=3)
        
        query_terms = set([word.lower() for word in query.split() if len(word) > 2])
        
        for res in tfidf_results:
            course_text = str(res.get('course_name', '') + " " + res.get('description', '')).lower()
            course_words = set(re.findall(r'\w+', course_text))
            matched = query_terms.intersection(course_words)
            if matched:
                res['explanation'] = "Exact keyword match"
                res['matched_terms'] = "Matched terms: " + ", ".join(list(matched)[:3])
            else:
                res['explanation'] = "Contains query terms"
                words_in_q = [w for w in query_terms if w in course_text]
                if words_in_q:
                    res['matched_terms'] = "Matched terms: " + ", ".join(words_in_q[:3])
                else:
                    res['matched_terms'] = ""
                
        for res in neural_results:
            res['explanation'] = "Related concept"
            skills = str(res.get('skills', '')).replace('jpeg', '').split()
            if skills and skills[0] != 'None':
                res['matched_terms'] = "Related concepts: " + " ".join(skills[:3]).strip()
            else:
                res['matched_terms'] = "Semantic similarity"
            
        return {
            'tfidf': tfidf_results,
            'neural': neural_results
        }

    def recommend_tfidf(self, query, top_n=10):
        """
        Get recommendations using TF-IDF model
        
        Args:
            query (str): User's search query
            top_n (int): Number of recommendations to return
            
        Returns:
            list: List of recommended courses with scores
        """
        try:
            # Transform query using TF-IDF vectorizer
            query_vector = self.tfidf_vectorizer.transform([query])
            
            # Calculate cosine similarity
            similarities = cosine_similarity(query_vector, self.tfidf_matrix).flatten()
            logger.debug('similarities')
            # Get top indices (more than N in case of duplicates)
            top_indices = similarities.argsort()[::-1]
            
            # Build recommendations
            recommendations = []
            seen_courses = set()
            for idx in top_indices:
                if len(recommendations) >= top_n:
                    break
                if similarities[idx] > 0:  # Only include courses with positive similarity
                    course = self.df.iloc[int(idx)]
                    course_name = course.get('course_name', 'Unknown')
                    
                    if course_name in seen_courses:
                        continue
                    seen_courses.add(course_name)
                    
                    description = clean_text(str(course.get('course_description', '')))
                    recommendations.append({
                        'course_id': int(idx),
                        'course_name': course_name,
                        'university': course.get('university'),
                        'course_url': course.get('course_url'),
                        'difficulty_level': course.get('difficulty_level'),
                        'course_rating': course.get('course_rating', 'None'),
                        'skills': course.get('skills', 'None'),
                        'description': description,
                        'score': float(similarities[idx])
                    })
            
            return recommendations
            
        except Exception as e:
            print(f"Error in TF-IDF recommendation: {e}")
            return []
    
    def recommend_neural(self, query, top_n=10):
        """
        Get recommendations using Neural model
        
        Args:
            query (str): User's search query
            top_n (int): Number of recommendations to return
            
        Returns:
            list: List of recommended courses with scores
        """
        try:
            # Encode the query
            query_embedding = self.neural_model.encode([query], convert_to_tensor=False)
            
            # Calculate cosine similarity with all course embeddings
            similarities = cosine_similarity(query_embedding, self.course_embeddings).flatten()
            
            # Get top indices (more than N in case of duplicates)
            top_indices = similarities.argsort()[::-1]
            
            # Build recommendations
            recommendations = []
            seen_courses = set()
            for idx in top_indices:
                if len(recommendations) >= top_n:
                    break
                course = self.df.iloc[int(idx)]
                course_name = course.get('course_name', 'Unknown')
                
                if course_name in seen_courses:
                    continue
                seen_courses.add(course_name)
                
                description = clean_text(str(course.get('course_description', '')))
                recommendations.append({
                    'course_id': int(idx),
                    'course_name': course_name,
                    'university': course.get('university'),
                    'course_url': course.get('course_url'),
                    'difficulty_level': course.get('difficulty_level'),
                    'course_rating': course.get('course_rating', 'None'),
                    'skills': course.get('skills', 'None'),
                    'description': description,
                    'score': float(similarities[idx])
                })
            
            return recommendations
            
        except Exception as e:
            print(f"Error in Neural recommendation: {e}")
            return []

    def get_recommendations(self, query, model_type='tfidf', top_n=10):
        """
        Main method to get recommendations
        
        Args:
            query (str): User's search query
            model_type (str): 'tfidf' or 'neural'
            top_n (int): Number of recommendations to return
            
        Returns:
            list: List of recommended courses
        """
        if model_type == 'tfidf':
            return self.recommend_tfidf(query, top_n)
        elif model_type == 'neural':
            return self.recommend_neural(query, top_n)
        else:
            raise ValueError(f"Unknown model type: {model_type}")

# Initialize recommender as singleton
recommender = None
def get_recommender():
    """Get or create recommender instance"""
    global recommender
    if recommender is None:
        recommender = CourseRecommender()
    return recommender