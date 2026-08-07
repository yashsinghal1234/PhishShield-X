from sklearn.base import BaseEstimator, TransformerMixin
import re
from urllib.parse import urlparse

class URLFeatureExtractor(BaseEstimator, TransformerMixin):
    def fit(self, X, y=None):
        return self
    
    def transform(self, X):
        features = []
        suspicious_words = ['login', 'secure', 'update', 'bank', 'admin', 'account', 'verify', 'confirm', 'password', 'free']
        for url in X:
            url_str = str(url).lower()
            if not url_str.startswith('http'):
                url_str = 'http://' + url_str
                
            try:
                parsed = urlparse(url_str)
                domain = parsed.netloc
                path_query = parsed.path + parsed.query
                scheme = parsed.scheme
            except ValueError:
                domain = ""
                path_query = url_str
                scheme = ""
            
            features.append([
                len(url_str),
                len(domain),
                len(path_query),
                domain.count('.'),
                domain.count('-'),
                path_query.count('-'),
                url_str.count('@'),
                path_query.count('?'),
                path_query.count('='),
                path_query.count('&'),
                path_query.count('/'),
                sum(c.isdigit() for c in domain),
                sum(c.isdigit() for c in path_query),
                1 if re.search(r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', domain) else 0,
                1 if scheme == 'https' else 0,
                sum(1 for word in suspicious_words if word in domain),
                sum(1 for word in suspicious_words if word in path_query)
            ])
        return features
