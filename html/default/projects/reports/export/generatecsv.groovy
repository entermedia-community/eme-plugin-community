import org.entermediadb.asset.util.CSVWriter
import org.openedit.Data
import org.openedit.hittracker.HitTracker
	

String sessionid = context.getRequestParameter("hitssessionid");
HitTracker hits = context.getSessionValue(sessionid);


String getName(String type, String inId)
{
	Data data = mediaarchive.getCachedData(type,inId);
	if( data != null)
	{
		return data.getName();
	}
	return null;
}

int count = 0;
Writer output = context.getPageStreamer().getOutput().getWriter();
CSVWriter writer  = new CSVWriter(output);

String[] array = context.getRequestParameters("detail");
List details = new ArrayList<>(Arrays.asList(array));

String[] headers = new String[details.size()];
for (Iterator iterator = details.iterator(); iterator.hasNext();)
{
		headers[count] = iterator.next();
		count++;
}

int rowcount = 0;
writer.writeNext(headers);
	log.info("about to start: " + hits.size() );

	for (Iterator iterator = hits.iterator(); iterator.hasNext();)
	{
		rowcount++;
		Data hit = null;
		try
		{
				hit =  iterator.next();
				nextrow = new String[details.size()];//make an extra spot for c
				int fieldcount = 0;
				for (Iterator detailiter = details.iterator(); detailiter.hasNext();)
				{
					String detail = detailiter.next();
					Object value = hit.getValue(detail);
					if( value != null)
					{
						
						if( detail == "collectionid")
						{
							nextrow[fieldcount] = getName("librarycollection",value.toString() );
						}
						else if( detail == "incometype")
						{
							nextrow[fieldcount] = getName("incometype",value.toString() );
						}
						else if( detail == "currencytype")
						{
							nextrow[fieldcount] = getName("currencytype",value.toString() );
						}
						else if( detail == "expensetype")
						{
							nextrow[fieldcount] = getName("expensetype",value.toString() );
						}
						else
						{
							nextrow[fieldcount] = value.toString();
						}
					}
					fieldcount++;
				}
				writer.writeNext(nextrow);
		}
		catch( Throwable ex)
		{
			log.error("Could not process row " + rowcount, ex );
			writer.flush();
			output.write("Could not process row " + rowcount + " " + ex );
			//output.write("Could not process path: " + hit.getSourcePath() + " id:" + hit.getId() );
			writer.flush();
		}
	}
	
writer.close();

//String finalout = output.toString();
//context.putPageValue("export", finalout);
context.setHasRedirected(true);


