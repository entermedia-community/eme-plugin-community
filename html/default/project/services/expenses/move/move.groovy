import org.entermediadb.asset.MediaArchive
import org.entermediadb.location.Position
import org.entermediadb.projects.*
import org.openedit.Data

import org.openedit.data.BaseSearcher
import org.openedit.data.Searcher

public void init()
{
	MediaArchive mediaArchive = context.getPageValue("mediaarchive");//Search for all files looking for videos
	BaseSearcher searcher = mediaArchive.getSearcher("collectiveexpense");

	String  id = context.getRequestParameter("id");
	
	Data data = searcher.searchById(id);
	String  targetcollectionid = context.getRequestParameter("parentcollectionid");
	String  topicid = context.getRequestParameter("collectiveproject.value");

	data.setValue("collectionid",targetcollectionid);
	data.setValue("collectiveproject",topicid);
	
	searcher.saveData(data);
	
}

init();