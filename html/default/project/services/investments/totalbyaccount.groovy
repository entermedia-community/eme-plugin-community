import org.elasticsearch.search.aggregations.AggregationBuilder
import org.elasticsearch.search.aggregations.AggregationBuilders
import org.elasticsearch.search.aggregations.Aggregations
import org.elasticsearch.search.aggregations.metrics.sum.SumBuilder
import org.openedit.data.Searcher
import org.openedit.hittracker.HitTracker
import org.openedit.hittracker.SearchQuery

public void init()
{
	String collectionid = context.getRequestParameter("collectionid");

	Searcher searcher = mediaarchive.getSearcher(context.findValue("searchtype"));
	SearchQuery query = searcher.addStandardSearchTerms(context);

	if( query == null)
	{
			query = searcher.query().exact("collectionid",collectionid).named("investments").sort("dateDown").getQuery();
	}
	
	String named = "paidfromaccount_totals";
	
	
	AggregationBuilder b = AggregationBuilders.terms(named).field("bankaccount");
	SumBuilder sum = new SumBuilder("total_sum");
	sum.field("total");
	b.subAggregation(sum);
	query.setAggregation(b);
	query.setHitsPerPage(50);
	HitTracker hits = searcher.cachedSearch(context,query);
	Map currencymap = hits.getAggregationMap(named);
//	log.info("query" + query + " hits " + hits.size() + " agr:" + hits.getActiveFilterValues() +  " map: " + currencymap);
	context.putPageValue(named,currencymap);
	context.putPageValue("searcher", searcher);
	context.putPageValue("investments", hits);
	
}

init();
	
