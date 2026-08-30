import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'ai'))
from prediction.predict import rank_candidates

def test_ranking_prefers_better_fit_and_balance():
    candidates = [
        {'location_id':1,'location_code':'01A01','capacity_fit':1.0,'weight_fit':0.9,'consolidation':0.9,'rack_balance':0.8,'accessibility':1.0,'adjacency':0.8,'fragmentation':0.9},
        {'location_id':2,'location_code':'02C10','capacity_fit':0.3,'weight_fit':0.3,'consolidation':0.4,'rack_balance':0.2,'accessibility':0.8,'adjacency':0.4,'fragmentation':0.3},
    ]
    ranked = rank_candidates(candidates)
    assert ranked[0]['location_code'] == '01A01'
    assert ranked[0]['score'] > ranked[1]['score']
    assert ranked[0]['model_version'].startswith('BREWSMART-MCDM')

def test_scores_are_bounded():
    ranked = rank_candidates([{'location_id':1,'location_code':'01A01','capacity_fit':99,'weight_fit':-2}])
    assert 0 <= ranked[0]['score'] <= 100
