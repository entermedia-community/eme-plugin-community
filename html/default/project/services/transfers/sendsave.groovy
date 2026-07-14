package importing;

import org.entermediadb.asset.MediaArchive
import org.openedit.Data
import org.openedit.data.Searcher


public void init()
{
	MediaArchive archive = context.getPageValue("mediaarchive");

	String collectionid = context.getRequestParameter("collectionid");
	
	Searcher searcher = archive.getSearcher("currencytransfer");
	Data tosave = data;
	
	tosave.setValue("date",new Date());
	tosave.setValue("user",context.getUserName());
	tosave.setValue("paymententitysourcetype","librarycollection"); //Project
	tosave.setValue("paymententitysource",collectionid); //
	
	tosave.setValue("currencytransferstatus","2"); //complete
	searcher.saveData(tosave);
		
}

init();


