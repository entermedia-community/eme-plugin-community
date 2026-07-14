import org.entermediadb.asset.importer.BaseImporter
import org.entermediadb.asset.util.Row
import org.openedit.data.*
import org.openedit.*
import org.openedit.data.*

class CsvImporter extends BaseImporter
{
	public String collectionid;
	
		protected Data findOrCreateById(String inTable, String id, String value)
		{
			if( inTable.equals("collectiveproject"))
			{
				Searcher searcher = getSearcherManager().getSearcher(getSearcher().getCatalogId(), inTable);
				Data data = (Data) searcher.query().exact("parentcollectionid", collectionid).match("name",value).searchOne();
				if (data == null)
				{
					data = searcher.createNewData();
					data.setId(id); //Hope its unique
					data.setName(value);
					data.setValue("parentcollectionid", collectionid);
					searcher.saveData(data, null);
				}
				return data;
			}
			Data data = super.findOrCreateById(inTable, id, value);
			return data;
		}

	public void addCustomProperties(Row inRow, Data inData)
	{
		inData.setValue("collectionid", collectionid);
	}

}

String collectionid = context.getRequestParameter("collectionid");

CsvImporter csvimporter = new CsvImporter();
csvimporter.setModuleManager(moduleManager);
csvimporter.setContext(context);
csvimporter.setLog(log);
csvimporter.setMakeId(false);
//csvimporter.addDbLookUp("collectiveproject");
csvimporter.collectionid = collectionid;
csvimporter.importData();
