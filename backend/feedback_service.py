"""
Post-Trip Feedback Service for Voyage
Collects and manages user feedback after trip completion
"""

from datetime import datetime
from typing import Dict, List, Optional
from google.cloud.firestore import Client


class FeedbackService:
    """Service for handling post-trip feedback"""
    
    def __init__(self, db: Client):
        self.db = db
        self.feedback_collection = db.collection('trip_feedback')
    
    def submit_feedback(
        self,
        trip_id: str,
        user_id: str,
        rating: int,
        experience: str,
        would_recommend: bool,
        highlights: List[str],
        improvements: List[str],
        comment: Optional[str] = None
    ) -> Dict:
        """
        Submit post-trip feedback
        
        Args:
            trip_id: ID of the trip
            user_id: ID of the user
            rating: Overall rating (1-5)
            experience: Overall experience (excellent/good/average/poor)
            would_recommend: Whether user would recommend
            highlights: List of trip highlights
            improvements: List of areas for improvement
            comment: Optional additional comments
            
        Returns:
            Feedback document data
        """
        feedback_data = {
            'trip_id': trip_id,
            'user_id': user_id,
            'rating': rating,
            'experience': experience,
            'would_recommend': would_recommend,
            'highlights': highlights,
            'improvements': improvements,
            'comment': comment or '',
            'created_at': datetime.now(),
            'updated_at': datetime.now()
        }
        
        # Check if feedback already exists
        existing = self.feedback_collection.where('trip_id', '==', trip_id).where('user_id', '==', user_id).limit(1).get()
        
        if existing:
            # Update existing feedback
            doc_id = existing[0].id
            self.feedback_collection.document(doc_id).update({
                **feedback_data,
                'created_at': existing[0].to_dict().get('created_at'),  # Keep original
                'updated_at': datetime.now()
            })
            feedback_data['feedback_id'] = doc_id
        else:
            # Create new feedback
            doc_ref = self.feedback_collection.add(feedback_data)
            feedback_data['feedback_id'] = doc_ref[1].id
        
        # Update trip with feedback flag
        try:
            trip_ref = self.db.collection('trip_plans').document(trip_id)
            trip_ref.update({
                'feedback_submitted': True,
                'feedback_date': datetime.now()
            })
        except Exception as e:
            print(f"Warning: Could not update trip feedback flag: {e}")
        
        print(f"✅ Feedback submitted for trip {trip_id}")
        return feedback_data
    
    def get_trip_feedback(self, trip_id: str) -> Optional[Dict]:
        """Get feedback for a specific trip"""
        results = self.feedback_collection.where('trip_id', '==', trip_id).limit(1).get()
        
        if results:
            feedback = results[0].to_dict()
            feedback['feedback_id'] = results[0].id
            return feedback
        
        return None
    
    def get_user_feedback_history(self, user_id: str) -> List[Dict]:
        """Get all feedback submitted by a user"""
        results = self.feedback_collection.where('user_id', '==', user_id).order_by('created_at', direction='DESCENDING').get()
        
        feedback_list = []
        for doc in results:
            feedback = doc.to_dict()
            feedback['feedback_id'] = doc.id
            feedback_list.append(feedback)
        
        return feedback_list
    
    def get_feedback_stats(self) -> Dict:
        """Get overall feedback statistics"""
        all_feedback = self.feedback_collection.get()
        
        if not all_feedback:
            return {
                'total_feedback': 0,
                'average_rating': 0,
                'recommendation_rate': 0,
                'top_highlights': [],
                'common_improvements': []
            }
        
        total = len(all_feedback)
        ratings = []
        recommendations = 0
        highlights_count = {}
        improvements_count = {}
        
        for doc in all_feedback:
            data = doc.to_dict()
            ratings.append(data.get('rating', 0))
            
            if data.get('would_recommend', False):
                recommendations += 1
            
            # Count highlights
            for highlight in data.get('highlights', []):
                highlights_count[highlight] = highlights_count.get(highlight, 0) + 1
            
            # Count improvements
            for improvement in data.get('improvements', []):
                improvements_count[improvement] = improvements_count.get(improvement, 0) + 1
        
        # Sort and get top items
        top_highlights = sorted(highlights_count.items(), key=lambda x: x[1], reverse=True)[:5]
        common_improvements = sorted(improvements_count.items(), key=lambda x: x[1], reverse=True)[:5]
        
        return {
            'total_feedback': total,
            'average_rating': sum(ratings) / len(ratings) if ratings else 0,
            'recommendation_rate': (recommendations / total * 100) if total > 0 else 0,
            'top_highlights': [{'item': h[0], 'count': h[1]} for h in top_highlights],
            'common_improvements': [{'item': i[0], 'count': i[1]} for i in common_improvements]
        }


# Singleton instance
_feedback_service_instance = None

def get_feedback_service(db: Client) -> FeedbackService:
    """Get or create the feedback service singleton"""
    global _feedback_service_instance
    if _feedback_service_instance is None:
        _feedback_service_instance = FeedbackService(db)
    return _feedback_service_instance
